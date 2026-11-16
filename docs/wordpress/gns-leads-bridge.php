<?php
/**
 * Plugin Name: GNS Leads Bridge
 * Description: Sends every WPForms submission to the GNS Onboarding & Compliance Platform as a lead. Works with WPForms Lite and Pro. If the platform cannot be reached, the enquiry is queued and retried every 15 minutes, so nothing is lost. The usual WPForms email to info@ is unaffected.
 * Version: 1.0.0
 * Author: GNS Associates
 *
 * INSTALL (once per website)
 *   1. Copy this file to wp-content/mu-plugins/gns-leads-bridge.php
 *      (create the mu-plugins folder if it is not there). A "must-use"
 *      plugin cannot be switched off by accident from the Plugins screen.
 *   2. Add these two lines to wp-config.php, above "That's all, stop editing!":
 *
 *        define( 'GNS_LEADS_URL',    'https://YOUR-APP-DOMAIN/api/leads/inbound?firm=gns' );
 *        define( 'GNS_LEADS_SECRET', 'the same value as LEADS_WEBHOOK_SECRET on the platform' );
 *
 *      Use firm=gns, firm=llp or firm=galaxy to say which practice the site is for.
 *      The secret is kept in wp-config.php, never in this file, so this file can
 *      be shared and version-controlled safely.
 *   3. Submit a test enquiry. It appears under Staff Portal → Leads within a minute.
 *
 * WHICH FORMS
 *   All of them by default. To send only some, list their WPForms IDs:
 *        define( 'GNS_LEADS_FORMS', '12,57' );
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const GNS_LEADS_QUEUE_OPTION = 'gns_leads_queue';
const GNS_LEADS_CRON_HOOK    = 'gns_leads_retry';
/** Give up on an item after this many attempts (15 min apart = about 2 days). */
const GNS_LEADS_MAX_ATTEMPTS = 200;

/**
 * WPForms calls this after a successful submission (spam checks passed, entry saved if Pro).
 *
 * @param array $fields    Sanitised fields: id => [ name, value, type, ... ].
 * @param array $entry     Raw submission.
 * @param array $form_data Form settings.
 * @param int   $entry_id  Entry id (0 on WPForms Lite, which stores no entries).
 */
add_action( 'wpforms_process_complete', 'gns_leads_capture', 20, 4 );

function gns_leads_capture( $fields, $entry, $form_data, $entry_id ) {
	if ( ! defined( 'GNS_LEADS_URL' ) || ! defined( 'GNS_LEADS_SECRET' ) ) {
		return;
	}
	$form_id = isset( $form_data['id'] ) ? (int) $form_data['id'] : 0;

	if ( defined( 'GNS_LEADS_FORMS' ) && GNS_LEADS_FORMS !== '' ) {
		$allowed = array_map( 'intval', explode( ',', GNS_LEADS_FORMS ) );
		if ( ! in_array( $form_id, $allowed, true ) ) {
			return;
		}
	}

	$list = array();
	foreach ( (array) $fields as $field ) {
		$list[] = array(
			'name'  => isset( $field['name'] ) ? (string) $field['name'] : '',
			'type'  => isset( $field['type'] ) ? (string) $field['type'] : '',
			'value' => isset( $field['value'] ) ? (string) $field['value'] : '',
		);
	}

	$payload = array(
		'form_id'    => (string) $form_id,
		'form_name'  => isset( $form_data['settings']['form_title'] ) ? (string) $form_data['settings']['form_title'] : '',
		// No entry id on Lite: send a unique id of our own so a retry is still recognised as the same enquiry.
		'entry_id'   => $entry_id ? (string) $entry_id : 'u' . wp_generate_uuid4(),
		'page_url'   => isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '',
		'site'       => home_url(),
		'fields'     => $list,
	);

	if ( ! gns_leads_send( $payload ) ) {
		gns_leads_enqueue( $payload );
	}
}

/**
 * Send one enquiry. True when the platform has it (new or already stored).
 * A short timeout: the visitor is waiting for the "thank you" message.
 */
function gns_leads_send( $payload ) {
	$response = wp_remote_post(
		GNS_LEADS_URL,
		array(
			'timeout' => 5,
			'headers' => array(
				'Content-Type'       => 'application/json',
				'X-GNS-Leads-Secret' => GNS_LEADS_SECRET,
			),
			'body'    => wp_json_encode( $payload ),
		)
	);
	if ( is_wp_error( $response ) ) {
		error_log( 'GNS Leads Bridge: send failed: ' . $response->get_error_message() );
		return false;
	}
	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( $code === 200 || $code === 201 ) {
		return true;
	}
	error_log( 'GNS Leads Bridge: platform answered HTTP ' . $code );
	// 400 / 413: the platform will never accept this one; do not retry forever.
	return in_array( $code, array( 400, 413 ), true );
}

function gns_leads_enqueue( $payload ) {
	$queue   = get_option( GNS_LEADS_QUEUE_OPTION, array() );
	$queue[] = array( 'payload' => $payload, 'attempts' => 1 );
	update_option( GNS_LEADS_QUEUE_OPTION, $queue, false );
	if ( ! wp_next_scheduled( GNS_LEADS_CRON_HOOK ) ) {
		wp_schedule_event( time() + 900, 'gns_fifteen_minutes', GNS_LEADS_CRON_HOOK );
	}
}

add_filter(
	'cron_schedules',
	function ( $schedules ) {
		$schedules['gns_fifteen_minutes'] = array( 'interval' => 900, 'display' => 'Every 15 minutes (GNS Leads Bridge)' );
		return $schedules;
	}
);

add_action( GNS_LEADS_CRON_HOOK, 'gns_leads_retry_queue' );

function gns_leads_retry_queue() {
	if ( ! defined( 'GNS_LEADS_URL' ) || ! defined( 'GNS_LEADS_SECRET' ) ) {
		return;
	}
	$queue = get_option( GNS_LEADS_QUEUE_OPTION, array() );
	$left  = array();
	foreach ( $queue as $item ) {
		if ( gns_leads_send( $item['payload'] ) ) {
			continue;
		}
		$item['attempts']++;
		if ( $item['attempts'] < GNS_LEADS_MAX_ATTEMPTS ) {
			$left[] = $item;
		} else {
			error_log( 'GNS Leads Bridge: gave up on a queued enquiry after ' . GNS_LEADS_MAX_ATTEMPTS . ' attempts. It is still in the WPForms email to info@.' );
		}
	}
	update_option( GNS_LEADS_QUEUE_OPTION, $left, false );
	if ( empty( $left ) ) {
		wp_clear_scheduled_hook( GNS_LEADS_CRON_HOOK );
	}
}
