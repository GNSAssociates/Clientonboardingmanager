<?php
/**
 * Plugin Name: GNS Leads Bridge
 * Description: Sends every WPForms submission to the GNS Onboarding & Compliance Platform as a lead (Staff Portal → Leads). Works with WPForms Lite and Pro. If the platform cannot be reached, the enquiry is queued and retried every 15 minutes. The usual WPForms email to info@ is unaffected. Settings → GNS Leads.
 * Version: 1.2.0
 * Author: GNS Associates
 * Requires PHP: 7.4
 *
 * INSTALL, EITHER WAY
 *   a) WP admin: Plugins → Add New → Upload Plugin → gns-leads-bridge.zip →
 *      Activate, then Settings → GNS Leads: choose the firm, paste the secret,
 *      press "Save and test".
 *   b) Files: copy this file to wp-content/mu-plugins/ and define in wp-config.php
 *        define( 'GNS_LEADS_URL',    'https://practiceagents.co.uk/api/leads/inbound?firm=gns' );
 *        define( 'GNS_LEADS_SECRET', '…' );
 *      wp-config values win over the settings page.
 *
 * The secret is the same value as LEADS_WEBHOOK_SECRET on the platform. It is
 * stored in the WordPress options table (or wp-config.php), never in this file,
 * and the settings page never shows it again once saved.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const GNS_LEADS_QUEUE_OPTION = 'gns_leads_queue';
const GNS_LEADS_CRON_HOOK    = 'gns_leads_retry';
const GNS_LEADS_DEFAULT_BASE = 'https://practiceagents.co.uk/api/leads/inbound';
/** Give up on an item after this many attempts (15 min apart = about 2 days). */
const GNS_LEADS_MAX_ATTEMPTS = 200;

/* ---------- Settings: wp-config constants first, then the settings page ---------- */

function gns_leads_url() {
	if ( defined( 'GNS_LEADS_URL' ) && GNS_LEADS_URL ) {
		return GNS_LEADS_URL;
	}
	$firm = get_option( 'gns_leads_firm', 'gns' );
	return add_query_arg( 'firm', rawurlencode( $firm ), get_option( 'gns_leads_base', GNS_LEADS_DEFAULT_BASE ) );
}

function gns_leads_secret() {
	if ( defined( 'GNS_LEADS_SECRET' ) && GNS_LEADS_SECRET ) {
		return GNS_LEADS_SECRET;
	}
	return (string) get_option( 'gns_leads_secret', '' );
}

function gns_leads_allowed_forms() {
	$list = defined( 'GNS_LEADS_FORMS' ) ? GNS_LEADS_FORMS : get_option( 'gns_leads_forms', '' );
	$list = trim( (string) $list );
	return $list === '' ? array() : array_filter( array_map( 'intval', explode( ',', $list ) ) );
}

/**
 * Forms that are never leads: a newsletter sign-up is not an enquiry, and
 * private feedback from a client is not a sale. Matched by title so it keeps
 * working if a form is rebuilt with a new id.
 */
function gns_leads_is_excluded_title( $title ) {
	return (bool) preg_match( '/newsletter|feedback|subscribe/i', (string) $title );
}

/** Should this form's submissions go to Leads? */
function gns_leads_wants_form( $form_id, $title ) {
	$allowed = gns_leads_allowed_forms();
	if ( $allowed ) {
		return in_array( (int) $form_id, $allowed, true );
	}
	return ! gns_leads_is_excluded_title( $title );
}

/** WordPress stores times in the site's time zone; send them with the offset so nothing shifts by an hour. */
function gns_leads_iso( $mysql_datetime ) {
	try {
		$d = new DateTime( (string) $mysql_datetime, wp_timezone() );
		return $d->format( DATE_ATOM );
	} catch ( Exception $e ) {
		return '';
	}
}

function gns_leads_ready() {
	$ready = gns_leads_url() !== '' && gns_leads_secret() !== '';
	// Remember when live forwarding started (site time). Past enquiries are
	// only those before it; later ones were already sent as they arrived.
	if ( $ready && ! get_option( 'gns_leads_live_since' ) ) {
		update_option( 'gns_leads_live_since', current_time( 'mysql' ), false );
	}
	return $ready;
}

/* ---------- Capture ---------- */

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
	if ( ! gns_leads_ready() ) {
		return;
	}
	$form_id = isset( $form_data['id'] ) ? (int) $form_data['id'] : 0;
	$title   = isset( $form_data['settings']['form_title'] ) ? (string) $form_data['settings']['form_title'] : '';
	if ( ! gns_leads_wants_form( $form_id, $title ) ) {
		return;
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
		'form_id'   => (string) $form_id,
		'form_name' => isset( $form_data['settings']['form_title'] ) ? (string) $form_data['settings']['form_title'] : '',
		// No entry id on Lite: send a unique id of our own so a retry is still recognised as the same enquiry.
		'entry_id'  => $entry_id ? (string) $entry_id : 'u' . wp_generate_uuid4(),
		'page_url'  => isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '',
		'site'      => home_url(),
		'fields'    => $list,
	);

	if ( ! gns_leads_send( $payload ) ) {
		gns_leads_enqueue( $payload );
	}
}

/**
 * Contact Form 7 (Quick Contact, Switch to GNS, …): forwarded the same way.
 * CF7 field names (your-name, your-email, tel-802) are understood by the platform.
 */
add_action( 'wpcf7_mail_sent', 'gns_leads_capture_cf7' );

function gns_leads_capture_cf7( $contact_form ) {
	if ( ! gns_leads_ready() || ! class_exists( 'WPCF7_Submission' ) ) {
		return;
	}
	$submission = WPCF7_Submission::get_instance();
	if ( ! $submission ) {
		return;
	}
	$form_id = (int) $contact_form->id();
	$title   = (string) $contact_form->title();
	if ( ! gns_leads_wants_form( $form_id, $title ) ) {
		return;
	}
	$payload = gns_leads_flat_payload( $form_id, $title, 'cf7-u' . wp_generate_uuid4(), (array) $submission->get_posted_data(), '' );
	$payload['page_url'] = esc_url_raw( (string) $submission->get_meta( 'url' ) );
	if ( ! gns_leads_send( $payload ) ) {
		gns_leads_enqueue( $payload );
	}
}

/** A submission stored as name => value (CF7, and both "DB" plugins). */
function gns_leads_flat_payload( $form_id, $title, $entry_id, $values, $submitted_at ) {
	$payload = array(
		'form_id'      => (string) $form_id,
		'form_name'    => (string) $title,
		'entry_id'     => (string) $entry_id,
		'site'         => home_url(),
		'submitted_at' => (string) $submitted_at,
	);
	foreach ( $values as $key => $value ) {
		$key = (string) $key;
		if ( $key === '' || isset( $payload[ $key ] ) || strpos( $key, '_wpcf7' ) === 0 || strpos( $key, 'cfdb7_' ) === 0 ) {
			continue;
		}
		if ( is_array( $value ) ) {
			$value = implode( ', ', array_map( 'strval', $value ) );
		}
		$payload[ $key ] = (string) $value;
	}
	return $payload;
}

/* ---------- Sending past enquiries from the WordPress database ---------- */

/**
 * Past submissions saved by "Database for WPForms" (table wpforms_db) and
 * "Contact Form 7 Database Addon" (table db7_forms). Each is sent with its
 * original date and a fixed entry id, so pressing the button twice does not
 * create duplicates on the platform.
 *
 * @return array{sent:int, skipped:int, failed:int, found:int}
 */
function gns_leads_backfill( $days ) {
	global $wpdb;
	$days   = max( 1, min( 3650, (int) $days ) );
	// form_date is site time, so compare in site time.
	$since  = wp_date( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
	$until  = get_option( 'gns_leads_live_since', current_time( 'mysql' ) );
	$result = array( 'sent' => 0, 'skipped' => 0, 'failed' => 0, 'found' => 0 );

	$sources = array(
		array( 'table' => $wpdb->prefix . 'wpforms_db', 'prefix' => 'wpfdb-' ),
		array( 'table' => $wpdb->prefix . 'db7_forms', 'prefix' => 'cf7db-' ),
	);
	foreach ( $sources as $src ) {
		$table = $src['table'];
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			continue;
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is from $wpdb->prefix, not user input.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT form_id, form_post_id, form_value, form_date FROM `{$table}` WHERE form_date >= %s AND form_date < %s ORDER BY form_date ASC", $since, $until ) );
		foreach ( (array) $rows as $row ) {
			$result['found']++;
			$title = get_the_title( (int) $row->form_post_id );
			if ( ! gns_leads_wants_form( (int) $row->form_post_id, $title ) ) {
				$result['skipped']++;
				continue;
			}
			$values = maybe_unserialize( $row->form_value );
			if ( ! is_array( $values ) ) {
				$result['skipped']++;
				continue;
			}
			$payload = gns_leads_flat_payload( (int) $row->form_post_id, $title, $src['prefix'] . (int) $row->form_id, $values, gns_leads_iso( $row->form_date ) );
			if ( gns_leads_send( $payload ) ) {
				$result['sent']++;
			} else {
				$result['failed']++;
			}
		}
	}
	return $result;
}

add_action( 'admin_post_gns_leads_backfill', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Not allowed.' );
	}
	check_admin_referer( 'gns_leads_backfill' );
	if ( ! gns_leads_ready() ) {
		set_transient( 'gns_leads_notice', array( 'ok' => false, 'text' => 'Connect first: save the secret, then send past enquiries.' ), 60 );
	} else {
		$days = isset( $_POST['gns_leads_days'] ) ? (int) $_POST['gns_leads_days'] : 60;
		$r    = gns_leads_backfill( $days );
		$text = sprintf( 'Past %d days: %d enquiries found, %d sent to Leads, %d skipped (not leads), %d failed.', $days, $r['found'], $r['sent'], $r['skipped'], $r['failed'] );
		if ( $r['failed'] ) {
			$text .= ' Press the button again to retry the failed ones; nothing is duplicated.';
		}
		set_transient( 'gns_leads_notice', array( 'ok' => ! $r['failed'], 'text' => $text ), 60 );
	}
	wp_safe_redirect( admin_url( 'options-general.php?page=gns-leads' ) );
	exit;
} );

/**
 * Send one enquiry. True when the platform has it (new or already stored).
 * A short timeout: the visitor is waiting for the "thank you" message.
 */
function gns_leads_send( $payload ) {
	$response = wp_remote_post(
		gns_leads_url(),
		array(
			'timeout' => 5,
			'headers' => array(
				'Content-Type'       => 'application/json',
				'X-GNS-Leads-Secret' => gns_leads_secret(),
			),
			'body'    => wp_json_encode( $payload ),
		)
	);
	if ( is_wp_error( $response ) ) {
		update_option( 'gns_leads_last_error', gmdate( 'Y-m-d H:i' ) . ' UTC: ' . $response->get_error_message(), false );
		return false;
	}
	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( $code === 200 || $code === 201 ) {
		update_option( 'gns_leads_last_ok', gmdate( 'Y-m-d H:i' ) . ' UTC', false );
		return true;
	}
	update_option( 'gns_leads_last_error', gmdate( 'Y-m-d H:i' ) . ' UTC: platform answered HTTP ' . $code, false );
	// 400 / 413: the platform will never accept this one; do not retry forever.
	return in_array( $code, array( 400, 413 ), true );
}

/* ---------- Retry queue ---------- */

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
	if ( ! gns_leads_ready() ) {
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
		}
	}
	update_option( GNS_LEADS_QUEUE_OPTION, $left, false );
	if ( empty( $left ) ) {
		wp_clear_scheduled_hook( GNS_LEADS_CRON_HOOK );
	}
}

register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( GNS_LEADS_CRON_HOOK );
} );

/* ---------- Settings page: Settings → GNS Leads ---------- */

add_action( 'admin_menu', function () {
	add_options_page( 'GNS Leads', 'GNS Leads', 'manage_options', 'gns-leads', 'gns_leads_settings_page' );
} );

add_action( 'admin_post_gns_leads_save', 'gns_leads_save_settings' );

function gns_leads_save_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Not allowed.' );
	}
	check_admin_referer( 'gns_leads_save' );

	$firm = isset( $_POST['gns_leads_firm'] ) ? sanitize_key( wp_unslash( $_POST['gns_leads_firm'] ) ) : 'gns';
	if ( ! in_array( $firm, array( 'gns', 'llp', 'galaxy' ), true ) ) {
		$firm = 'gns';
	}
	update_option( 'gns_leads_firm', $firm, false );

	$base = isset( $_POST['gns_leads_base'] ) ? esc_url_raw( trim( wp_unslash( $_POST['gns_leads_base'] ) ) ) : '';
	update_option( 'gns_leads_base', $base && strpos( $base, 'https://' ) === 0 ? $base : GNS_LEADS_DEFAULT_BASE, false );

	$forms = isset( $_POST['gns_leads_forms'] ) ? preg_replace( '/[^0-9,]/', '', wp_unslash( $_POST['gns_leads_forms'] ) ) : '';
	update_option( 'gns_leads_forms', $forms, false );

	// Blank means "keep the saved secret": it is never sent back to the browser to re-submit.
	$secret = isset( $_POST['gns_leads_secret'] ) ? trim( wp_unslash( $_POST['gns_leads_secret'] ) ) : '';
	if ( $secret !== '' ) {
		update_option( 'gns_leads_secret', $secret, false );
	}

	$test = gns_leads_test_connection();
	set_transient( 'gns_leads_notice', $test, 60 );
	wp_safe_redirect( admin_url( 'options-general.php?page=gns-leads' ) );
	exit;
}

/** Asks the platform whether it accepts our secret. Sends no lead. */
function gns_leads_test_connection() {
	if ( ! gns_leads_ready() ) {
		return array( 'ok' => false, 'text' => 'Saved. Add the secret to finish connecting.' );
	}
	$response = wp_remote_get( gns_leads_url(), array( 'timeout' => 8, 'headers' => array( 'X-GNS-Leads-Secret' => gns_leads_secret() ) ) );
	if ( is_wp_error( $response ) ) {
		return array( 'ok' => false, 'text' => 'Could not reach the platform: ' . $response->get_error_message() );
	}
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! empty( $body['authorised'] ) ) {
		return array( 'ok' => true, 'text' => 'Connected. New WPForms enquiries will appear in Staff Portal → Leads.' );
	}
	if ( isset( $body['configured'] ) && ! $body['configured'] ) {
		return array( 'ok' => false, 'text' => 'The platform has no secret set yet (LEADS_WEBHOOK_SECRET on cPanel). Set it, restart the app, then save here again.' );
	}
	return array( 'ok' => false, 'text' => 'The platform did not accept this secret. Check it matches LEADS_WEBHOOK_SECRET exactly.' );
}

function gns_leads_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$notice  = get_transient( 'gns_leads_notice' );
	delete_transient( 'gns_leads_notice' );
	$firm    = get_option( 'gns_leads_firm', 'gns' );
	$base    = get_option( 'gns_leads_base', GNS_LEADS_DEFAULT_BASE );
	$forms   = get_option( 'gns_leads_forms', '' );
	$has     = gns_leads_secret() !== '';
	$locked  = defined( 'GNS_LEADS_URL' ) || defined( 'GNS_LEADS_SECRET' );
	$queue   = count( (array) get_option( GNS_LEADS_QUEUE_OPTION, array() ) );
	$last_ok = get_option( 'gns_leads_last_ok', '' );
	$last_er = get_option( 'gns_leads_last_error', '' );
	?>
	<div class="wrap">
		<h1>GNS Leads</h1>
		<p>Sends every WPForms enquiry to the GNS platform (Staff Portal → Leads). The usual email to info@ still goes out.</p>
		<?php if ( $notice ) : ?>
			<div class="notice <?php echo $notice['ok'] ? 'notice-success' : 'notice-warning'; ?>"><p><?php echo esc_html( $notice['text'] ); ?></p></div>
		<?php endif; ?>
		<?php if ( $locked ) : ?>
			<div class="notice notice-info"><p>Settings in wp-config.php are in use and override this page.</p></div>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="gns_leads_save">
			<?php wp_nonce_field( 'gns_leads_save' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="gns_leads_firm">This website is for</label></th>
					<td><select name="gns_leads_firm" id="gns_leads_firm">
						<option value="gns" <?php selected( $firm, 'gns' ); ?>>GNS Associates Ltd</option>
						<option value="llp" <?php selected( $firm, 'llp' ); ?>>GNS Associates UK LLP</option>
						<option value="galaxy" <?php selected( $firm, 'galaxy' ); ?>>Galaxy Accountants</option>
					</select></td>
				</tr>
				<tr>
					<th scope="row"><label for="gns_leads_secret">Secret</label></th>
					<td>
						<input type="password" name="gns_leads_secret" id="gns_leads_secret" class="regular-text" autocomplete="new-password"
							placeholder="<?php echo $has ? 'Saved. Leave blank to keep it' : 'Paste LEADS_WEBHOOK_SECRET'; ?>">
						<p class="description">The same value as LEADS_WEBHOOK_SECRET on the platform. Never shown again after saving.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="gns_leads_forms">Only these forms</label></th>
					<td>
						<input type="text" name="gns_leads_forms" id="gns_leads_forms" class="regular-text" value="<?php echo esc_attr( $forms ); ?>" placeholder="All forms">
						<p class="description">Optional. Form IDs separated by commas, e.g. 17202,19919. Blank sends every form except newsletter and feedback forms.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="gns_leads_base">Platform address</label></th>
					<td><input type="url" name="gns_leads_base" id="gns_leads_base" class="regular-text" value="<?php echo esc_attr( $base ); ?>"></td>
				</tr>
			</table>
			<?php submit_button( 'Save and test' ); ?>
		</form>
		<h2>Send past enquiries</h2>
		<p>Sends enquiries already saved in WordPress (by "Database for WPForms" and "Contact Form 7 Database") to Leads, with their original dates. Newsletter and feedback forms are left out. Only enquiries from before live forwarding started<?php $ls = get_option( 'gns_leads_live_since' ); echo $ls ? ' (' . esc_html( $ls ) . ')' : ''; ?> are sent, since later ones arrived by themselves. Safe to press more than once: nothing is duplicated.</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="gns_leads_backfill">
			<?php wp_nonce_field( 'gns_leads_backfill' ); ?>
			<label>From the last <input type="number" name="gns_leads_days" value="60" min="1" max="3650" style="width:80px"> days</label>
			<?php submit_button( 'Send past enquiries', 'secondary', 'submit', false ); ?>
		</form>
		<h2>Status</h2>
		<p>
			Last enquiry delivered: <?php echo esc_html( $last_ok ? $last_ok : 'none yet' ); ?><br>
			Waiting to retry: <?php echo (int) $queue; ?><br>
			<?php if ( $last_er ) : ?>Last problem: <?php echo esc_html( $last_er ); ?><?php endif; ?>
		</p>
	</div>
	<?php
}

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=gns-leads' ) ) . '">Settings</a>' );
	return $links;
} );
