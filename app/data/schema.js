/**
 * schema.js — the platform's data model, declared once.
 *
 * This is the contract every module reads from. The Data Model explorer renders
 * it, DataTable derives column types from it, and seed.js generates rows for it.
 * Change a table here and the change shows up everywhere.
 *
 * Field types: id | ref | string | text | email | phone | url | slug | money |
 *              int | float | pct | bool | date | time | datetime | enum | json | array
 */

const T = (id, label, group, desc, fields, extra = {}) =>
  ({ id, label, group, desc, pk: 'pk', fields, ...extra });

const f = (name, type, label, opts = {}) => ({ name, type, label, ...opts });

export const GROUPS = [
  { id: 'Org',          desc: 'Who the operator is, where they operate, and who can log in.' },
  { id: 'Catalog',      desc: 'What is for sale: products, schedules, prices and capacity.' },
  { id: 'Sales',        desc: 'Reservations and the people on them.' },
  { id: 'Money',        desc: 'Charges, refunds, taxes, and the payouts that settle them.' },
  { id: 'Distribution', desc: 'Every channel a booking can arrive through.' },
  { id: 'Operations',   desc: 'Running the day: manifests, check-in, resources, waivers.' },
  { id: 'Engagement',   desc: 'Messaging, marketing, gift cards, memberships.' },
  { id: 'System',       desc: 'Audit, configuration and integration plumbing.' },
];

export const SCHEMA = [

  /* ------------------------------------------------------------------ Org */
  T('company', 'Companies', 'Org',
    'The operator account. Everything in the dashboard is scoped to one company shortname.', [
    f('pk', 'id', 'ID'),
    f('shortname', 'slug', 'Shortname', { desc: 'URL key: fareharbor.com/<shortname>/' }),
    f('name', 'string', 'Company name', { required: true }),
    f('timezone', 'string', 'Timezone'),
    f('currency', 'string', 'Currency'),
    f('country', 'string', 'Country'),
    f('phone', 'phone', 'Phone'),
    f('email', 'email', 'Support email'),
    f('website', 'url', 'Website'),
    f('address', 'text', 'Address'),
    f('status', 'enum', 'Status', { enum: ['active', 'trial', 'suspended'] }),
    f('logo_color', 'string', 'Brand color'),
  ]),

  T('location', 'Locations', 'Org',
    'Physical places: offices, docks, trailheads, meeting points and shops.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name', { required: true }),
    f('kind', 'enum', 'Kind', { enum: ['office', 'meeting_point', 'dock', 'shop', 'warehouse'] }),
    f('address', 'text', 'Address'),
    f('lat', 'float', 'Latitude'), f('lng', 'float', 'Longitude'),
    f('directions', 'text', 'Arrival directions'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('user', 'Users', 'Org',
    'Dashboard logins. Permissions come from roles, optionally narrowed to locations.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name', { required: true }),
    f('email', 'email', 'Email', { required: true }),
    f('phone', 'phone', 'Phone'),
    f('role', 'ref', 'Role', { ref: 'role' }),
    f('status', 'enum', 'Status', { enum: ['active', 'invited', 'disabled'] }),
    f('last_login', 'datetime', 'Last login'),
    f('two_factor', 'bool', '2FA enabled'),
    f('location_scope', 'array', 'Restricted to locations'),
  ]),

  T('role', 'Roles', 'Org',
    'A named bundle of permissions. Owner, Manager, Front desk, Guide, Read-only, Accountant.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Role name', { required: true }),
    f('description', 'text', 'Description'),
    f('permissions', 'array', 'Permission keys'),
    f('is_system', 'bool', 'Built-in'),
    f('user_count', 'int', 'Users'),
  ]),

  /* -------------------------------------------------------------- Catalog */
  T('item', 'Items', 'Catalog',
    'A bookable product — a tour, activity, rental, class, or ticket. The centre of the catalog.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Item name', { required: true }),
    f('slug', 'slug', 'Slug'),
    f('category', 'enum', 'Category', { enum: ['tour', 'rental', 'lesson', 'ticket', 'charter', 'event'] }),
    f('status', 'enum', 'Status', { enum: ['live', 'draft', 'paused', 'archived'] }),
    f('headline', 'string', 'Headline'),
    f('description', 'text', 'Description'),
    f('duration_minutes', 'int', 'Duration'),
    f('capacity_default', 'int', 'Default capacity'),
    f('min_party', 'int', 'Minimum party size'),
    f('max_party', 'int', 'Maximum party size'),
    f('location', 'ref', 'Meeting location', { ref: 'location' }),
    f('cancellation_policy', 'ref', 'Cancellation policy', { ref: 'cancellation_policy' }),
    f('booking_cutoff_minutes', 'int', 'Online cutoff'),
    f('requires_waiver', 'bool', 'Requires waiver'),
    f('online_booking', 'bool', 'Bookable online'),
    f('deposit_pct', 'pct', 'Deposit %'),
    f('image', 'url', 'Hero image'),
    f('sort_order', 'int', 'Sort order'),
  ]),

  T('customer_type', 'Customer types', 'Catalog',
    'Who a seat is for — Adult, Child, Senior, Student, Observer. Defined per company.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('singular', 'string', 'Singular', { required: true }),
    f('plural', 'string', 'Plural'),
    f('note', 'string', 'Qualifier', { desc: 'e.g. "Ages 6–12"' }),
    f('counts_against_capacity', 'bool', 'Uses a seat'),
  ]),

  T('customer_type_rate', 'Rates', 'Catalog',
    'The price of one customer type on one item. Availability-level overrides create seasonal pricing.', [
    f('pk', 'id', 'ID'),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('customer_type', 'ref', 'Customer type', { ref: 'customer_type' }),
    f('availability', 'ref', 'Availability override', { ref: 'availability' }),
    f('total', 'money', 'Price'),
    f('cost', 'money', 'Cost basis'),
    f('minimum_party_size', 'int', 'Min qty'),
    f('maximum_party_size', 'int', 'Max qty'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('availability', 'Availabilities', 'Catalog',
    'One dated, timed departure of an item with its own capacity. What guests actually book.', [
    f('pk', 'id', 'ID'),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('date', 'date', 'Date'),
    f('start_time', 'time', 'Start'),
    f('end_time', 'time', 'End'),
    f('capacity', 'int', 'Capacity'),
    f('booked', 'int', 'Booked'),
    f('headline', 'string', 'Override headline'),
    f('status', 'enum', 'Status', { enum: ['open', 'sold_out', 'cancelled', 'hidden'] }),
    f('online_status', 'enum', 'Online', { enum: ['bookable', 'call_only', 'closed'] }),
    f('template', 'ref', 'From template', { ref: 'availability_template' }),
    f('notes', 'text', 'Internal notes'),
  ], { indexes: ['item+date', 'date'] }),

  T('availability_template', 'Schedules', 'Catalog',
    'A recurrence rule that generates availabilities: days of week, times, date range, capacity.', [
    f('pk', 'id', 'ID'),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('name', 'string', 'Schedule name'),
    f('start_date', 'date', 'Starts'),
    f('end_date', 'date', 'Ends'),
    f('days_of_week', 'array', 'Days'),
    f('times', 'array', 'Departure times'),
    f('capacity', 'int', 'Capacity per slot'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('addon', 'Add-ons', 'Catalog',
    'Optional extras attached to an item: photo package, wetsuit, lunch, insurance.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name'),
    f('price', 'money', 'Price'),
    f('charge_basis', 'enum', 'Charged', { enum: ['per_customer', 'per_booking'] }),
    f('items', 'array', 'Applies to items'),
    f('inventory', 'int', 'Stock'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('cancellation_policy', 'Cancellation policies', 'Catalog',
    'Refund windows: how close to departure a guest can cancel and what they get back.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name'),
    f('cutoff_hours', 'int', 'Free-cancel window'),
    f('refund_pct', 'pct', 'Refund after cutoff'),
    f('description', 'text', 'Guest-facing text'),
  ]),

  /* ---------------------------------------------------------------- Sales */
  T('booking', 'Bookings', 'Sales',
    'The reservation. Joins an availability to a contact, its customers, its money and its history.', [
    f('pk', 'id', 'ID'),
    f('code', 'string', 'Confirmation #'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('availability', 'ref', 'Availability', { ref: 'availability' }),
    f('contact', 'ref', 'Contact', { ref: 'contact' }),
    f('status', 'enum', 'Status', { enum: ['confirmed', 'pending', 'cancelled', 'no_show', 'completed'] }),
    f('channel', 'ref', 'Channel', { ref: 'channel' }),
    f('affiliate', 'ref', 'Affiliate', { ref: 'affiliate' }),
    f('pax', 'int', 'Guests'),
    f('subtotal', 'money', 'Subtotal'),
    f('tax_total', 'money', 'Taxes & fees'),
    f('discount_total', 'money', 'Discounts'),
    f('total', 'money', 'Total'),
    f('paid', 'money', 'Paid'),
    f('balance', 'money', 'Balance due'),
    f('created_at', 'datetime', 'Booked at'),
    f('created_by', 'ref', 'Booked by', { ref: 'user' }),
    f('promo_code', 'ref', 'Promo code', { ref: 'promo_code' }),
    f('lodging', 'ref', 'Pickup', { ref: 'lodging' }),
    f('is_checked_in', 'bool', 'Checked in'),
    f('waiver_status', 'enum', 'Waivers', { enum: ['not_required', 'pending', 'partial', 'signed'] }),
    f('source_url', 'url', 'Booked from'),
  ], { indexes: ['availability', 'contact', 'code'] }),

  T('booking_customer', 'Booking customers', 'Sales',
    'One seat on a booking: which customer type, at which rate, plus their custom field answers.', [
    f('pk', 'id', 'ID'),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('customer_type_rate', 'ref', 'Rate', { ref: 'customer_type_rate' }),
    f('name', 'string', 'Name'),
    f('email', 'email', 'Email'),
    f('phone', 'phone', 'Phone'),
    f('price', 'money', 'Price'),
    f('checked_in_at', 'datetime', 'Checked in'),
    f('waiver_signed', 'bool', 'Waiver signed'),
  ]),

  T('contact', 'Contacts', 'Sales',
    'The guest record. Deduplicated by email so lifetime value and history survive rebooking.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name', { required: true }),
    f('email', 'email', 'Email'),
    f('phone', 'phone', 'Phone'),
    f('country', 'string', 'Country'),
    f('city', 'string', 'City'),
    f('marketing_opt_in', 'bool', 'Marketing consent'),
    f('booking_count', 'int', 'Bookings'),
    f('lifetime_value', 'money', 'Lifetime value'),
    f('first_booked', 'date', 'First booked'),
    f('last_booked', 'date', 'Last booked'),
    f('tags', 'array', 'Tags'),
    f('notes', 'text', 'Notes'),
  ]),

  T('note', 'Notes', 'Sales',
    'Free text on a booking or contact. Internal notes never reach the guest; public ones do.', [
    f('pk', 'id', 'ID'),
    f('target_type', 'enum', 'Attached to', { enum: ['booking', 'contact', 'availability', 'item'] }),
    f('target', 'ref', 'Target ID'),
    f('visibility', 'enum', 'Visibility', { enum: ['internal', 'guest_visible', 'manifest'] }),
    f('body', 'text', 'Note'),
    f('author', 'ref', 'Author', { ref: 'user' }),
    f('created_at', 'datetime', 'Created'),
  ]),

  T('custom_field', 'Custom fields', 'Sales',
    'Operator-defined questions. Attach at booking, per-customer, or item level; feed the manifest.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('title', 'string', 'Question', { required: true }),
    f('type', 'enum', 'Field type', { enum: ['short_text', 'long_text', 'number', 'select', 'multi_select', 'checkbox', 'date', 'file'] }),
    f('level', 'enum', 'Asked at', { enum: ['booking', 'customer', 'item'] }),
    f('options', 'array', 'Choices'),
    f('is_required', 'bool', 'Required'),
    f('show_on_manifest', 'bool', 'On manifest'),
    f('items', 'array', 'Applies to items'),
    f('description', 'text', 'Helper text'),
  ]),

  T('custom_field_value', 'Custom field answers', 'Sales',
    'The answer a guest or agent gave, joined back to the booking or the individual customer.', [
    f('pk', 'id', 'ID'),
    f('custom_field', 'ref', 'Field', { ref: 'custom_field' }),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('booking_customer', 'ref', 'Customer', { ref: 'booking_customer' }),
    f('value', 'string', 'Answer'),
  ]),

  /* ---------------------------------------------------------------- Money */
  T('payment', 'Payments', 'Money',
    'Every money movement against a booking: card charges, cash, refunds, voids, chargebacks.', [
    f('pk', 'id', 'ID'),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('kind', 'enum', 'Type', { enum: ['charge', 'refund', 'void', 'chargeback', 'adjustment'] }),
    f('method', 'enum', 'Method', { enum: ['card', 'cash', 'check', 'gift_card', 'invoice', 'apple_pay', 'terminal'] }),
    f('amount', 'money', 'Amount'),
    f('fee', 'money', 'Processing fee'),
    f('net', 'money', 'Net'),
    f('status', 'enum', 'Status', { enum: ['succeeded', 'pending', 'failed', 'refunded', 'disputed'] }),
    f('card_brand', 'string', 'Card'),
    f('card_last4', 'string', 'Last 4'),
    f('processor_ref', 'string', 'Processor ref'),
    f('created_at', 'datetime', 'Processed'),
    f('payout', 'ref', 'Payout', { ref: 'payout' }),
    f('created_by', 'ref', 'Taken by', { ref: 'user' }),
  ]),

  T('payout', 'Payouts', 'Money',
    'A settlement batch wired to the operator bank account. Gross minus fees minus refunds.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('reference', 'string', 'Reference'),
    f('period_start', 'date', 'Period start'),
    f('period_end', 'date', 'Period end'),
    f('gross', 'money', 'Gross sales'),
    f('refunds', 'money', 'Refunds'),
    f('fees', 'money', 'Fees'),
    f('adjustments', 'money', 'Adjustments'),
    f('net', 'money', 'Net paid'),
    f('status', 'enum', 'Status', { enum: ['paid', 'in_transit', 'scheduled', 'failed'] }),
    f('paid_on', 'date', 'Paid on'),
    f('bank_last4', 'string', 'Bank acct'),
    f('transaction_count', 'int', 'Transactions'),
  ]),

  T('tax_fee', 'Taxes & fees', 'Money',
    'Percentage or flat charges layered onto a booking: sales tax, park fee, fuel surcharge.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name'),
    f('kind', 'enum', 'Type', { enum: ['tax', 'fee'] }),
    f('calculation', 'enum', 'Calculation', { enum: ['percent', 'flat_per_booking', 'flat_per_customer'] }),
    f('rate', 'float', 'Rate'),
    f('applies_to', 'array', 'Applies to items'),
    f('is_inclusive', 'bool', 'Included in price'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('promo_code', 'Promo codes', 'Money',
    'Discount codes with usage caps, date windows, and item or channel restrictions.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('code', 'string', 'Code', { required: true }),
    f('kind', 'enum', 'Discount', { enum: ['percent', 'fixed'] }),
    f('value', 'float', 'Value'),
    f('starts', 'date', 'Valid from'),
    f('ends', 'date', 'Valid until'),
    f('max_uses', 'int', 'Usage cap'),
    f('used', 'int', 'Times used'),
    f('items', 'array', 'Limited to items'),
    f('channels', 'array', 'Limited to channels'),
    f('is_active', 'bool', 'Active'),
  ]),

  /* --------------------------------------------------------- Distribution */
  T('channel', 'Channels', 'Distribution',
    'Where a booking originated. Every booking carries one; every report can split by it.', [
    f('pk', 'id', 'ID'),
    f('name', 'string', 'Channel'),
    f('kind', 'enum', 'Kind', { enum: ['direct_online', 'dashboard', 'kiosk', 'pos', 'affiliate', 'ota', 'api'] }),
    f('commission_pct', 'pct', 'Typical commission'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('affiliate', 'Affiliates', 'Distribution',
    'Resellers, concierges and OTAs who sell your inventory, each on their own commission terms.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Affiliate'),
    f('kind', 'enum', 'Type', { enum: ['reseller', 'concierge', 'ota', 'network'] }),
    f('contact_name', 'string', 'Contact'),
    f('email', 'email', 'Email'),
    f('phone', 'phone', 'Phone'),
    f('commission_pct', 'pct', 'Commission'),
    f('payment_terms', 'enum', 'Terms', { enum: ['net_of_commission', 'invoice_monthly', 'prepaid'] }),
    f('bookings_ytd', 'int', 'Bookings YTD'),
    f('revenue_ytd', 'money', 'Revenue YTD'),
    f('commission_owed', 'money', 'Commission owed'),
    f('status', 'enum', 'Status', { enum: ['active', 'pending', 'paused'] }),
  ]),

  T('widget', 'Book buttons & widgets', 'Distribution',
    'The embeddable Lightframe entry points: buttons, inline calendars, full-page flows.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Name'),
    f('kind', 'enum', 'Type', { enum: ['button', 'inline_calendar', 'item_list', 'full_page', 'popup'] }),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('flow', 'enum', 'Flow', { enum: ['lightframe', 'new_tab', 'inline'] }),
    f('theme_color', 'string', 'Accent'),
    f('placement', 'string', 'Where it lives'),
    f('views_30d', 'int', 'Views 30d'),
    f('bookings_30d', 'int', 'Bookings 30d'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('external_listing', 'Marketplace listings', 'Distribution',
    'Syndicated listings — Google Things to Do, OTAs — with their sync state and last error.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('marketplace', 'string', 'Marketplace'),
    f('item', 'ref', 'Item', { ref: 'item' }),
    f('external_id', 'string', 'External ID'),
    f('sync_status', 'enum', 'Sync', { enum: ['live', 'syncing', 'error', 'paused'] }),
    f('last_sync', 'datetime', 'Last sync'),
    f('last_error', 'string', 'Last error'),
    f('bookings_30d', 'int', 'Bookings 30d'),
  ]),

  /* ----------------------------------------------------------- Operations */
  T('resource', 'Resources', 'Operations',
    'Finite things a departure consumes: boats, vans, bikes, rooms and the guides who run it.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Resource'),
    f('kind', 'enum', 'Type', { enum: ['vehicle', 'vessel', 'equipment', 'staff', 'room'] }),
    f('capacity', 'int', 'Capacity'),
    f('location', 'ref', 'Home location', { ref: 'location' }),
    f('status', 'enum', 'Status', { enum: ['available', 'in_use', 'maintenance', 'retired'] }),
    f('notes', 'text', 'Notes'),
  ]),

  T('resource_assignment', 'Resource assignments', 'Operations',
    'Which resource is committed to which departure. Double-booking is detected here.', [
    f('pk', 'id', 'ID'),
    f('resource', 'ref', 'Resource', { ref: 'resource' }),
    f('availability', 'ref', 'Availability', { ref: 'availability' }),
    f('role', 'string', 'Role'),
    f('status', 'enum', 'Status', { enum: ['assigned', 'tentative', 'released'] }),
  ]),

  T('waiver_template', 'Waiver templates', 'Operations',
    'The legal document guests sign, with the signer rules and which items require it.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Template'),
    f('version', 'string', 'Version'),
    f('body', 'text', 'Waiver text'),
    f('minor_policy', 'enum', 'Minors', { enum: ['guardian_signs', 'separate_waiver', 'not_allowed'] }),
    f('items', 'array', 'Required for items'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('waiver_signature', 'Signatures', 'Operations',
    'One signed waiver, tied to a person on a booking, with IP and timestamp for evidence.', [
    f('pk', 'id', 'ID'),
    f('template', 'ref', 'Template', { ref: 'waiver_template' }),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('booking_customer', 'ref', 'Signer', { ref: 'booking_customer' }),
    f('signer_name', 'string', 'Signed by'),
    f('signed_at', 'datetime', 'Signed at'),
    f('ip_address', 'string', 'IP'),
    f('is_minor', 'bool', 'Minor'),
    f('guardian_name', 'string', 'Guardian'),
  ]),

  T('checkin', 'Check-ins', 'Operations',
    'The day-of record: who showed up, when, and on which device.', [
    f('pk', 'id', 'ID'),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('availability', 'ref', 'Availability', { ref: 'availability' }),
    f('checked_in_count', 'int', 'Checked in'),
    f('total_count', 'int', 'Expected'),
    f('checked_in_at', 'datetime', 'Time'),
    f('by_user', 'ref', 'By', { ref: 'user' }),
    f('device', 'enum', 'Device', { enum: ['dashboard', 'mobile_app', 'kiosk', 'scanner'] }),
  ]),

  T('lodging', 'Lodgings & pickups', 'Operations',
    'Hotels and stops guests can be collected from, with pickup offsets per item.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Lodging'),
    f('address', 'text', 'Address'),
    f('pickup_offset_minutes', 'int', 'Pickup offset'),
    f('zone', 'string', 'Zone'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('task', 'Tasks', 'Operations',
    'Follow-ups the team owes: unpaid balances, missing waivers, callbacks, damage reports.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('title', 'string', 'Task'),
    f('kind', 'enum', 'Type', { enum: ['balance_due', 'waiver_missing', 'callback', 'maintenance', 'review', 'other'] }),
    f('booking', 'ref', 'Related booking', { ref: 'booking' }),
    f('assignee', 'ref', 'Assigned to', { ref: 'user' }),
    f('due_date', 'date', 'Due'),
    f('priority', 'enum', 'Priority', { enum: ['low', 'normal', 'high', 'urgent'] }),
    f('status', 'enum', 'Status', { enum: ['open', 'in_progress', 'done', 'dismissed'] }),
  ]),

  /* ----------------------------------------------------------- Engagement */
  T('message_template', 'Message templates', 'Engagement',
    'Automated guest email and SMS: confirmations, reminders, waiver chases, post-trip reviews.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Template'),
    f('trigger', 'enum', 'Trigger', { enum: ['booking_confirmed', 'reminder_24h', 'reminder_48h', 'waiver_request', 'balance_due', 'cancelled', 'post_trip', 'manual'] }),
    f('medium', 'enum', 'Medium', { enum: ['email', 'sms'] }),
    f('subject', 'string', 'Subject'),
    f('body', 'text', 'Body'),
    f('offset_hours', 'int', 'Send offset'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('message_log', 'Message log', 'Engagement',
    'Every message actually sent, with delivery state — the answer to "did they get it?"', [
    f('pk', 'id', 'ID'),
    f('template', 'ref', 'Template', { ref: 'message_template' }),
    f('booking', 'ref', 'Booking', { ref: 'booking' }),
    f('to', 'string', 'Recipient'),
    f('medium', 'enum', 'Medium', { enum: ['email', 'sms'] }),
    f('subject', 'string', 'Subject'),
    f('status', 'enum', 'Status', { enum: ['delivered', 'sent', 'opened', 'bounced', 'failed'] }),
    f('sent_at', 'datetime', 'Sent'),
  ]),

  T('gift_card', 'Gift cards', 'Engagement',
    'Stored-value cards. The outstanding balance across all of them is a real liability.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('code', 'string', 'Code'),
    f('initial_value', 'money', 'Issued for'),
    f('balance', 'money', 'Balance'),
    f('purchaser_name', 'string', 'Purchased by'),
    f('purchaser_email', 'email', 'Purchaser email'),
    f('recipient_name', 'string', 'Recipient'),
    f('issued_on', 'date', 'Issued'),
    f('expires_on', 'date', 'Expires'),
    f('status', 'enum', 'Status', { enum: ['active', 'redeemed', 'expired', 'void'] }),
  ]),

  T('membership_type', 'Membership plans', 'Engagement',
    'Recurring passes: season passes, unlimited clubs, multi-visit punch cards.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Plan'),
    f('price', 'money', 'Price'),
    f('billing', 'enum', 'Billing', { enum: ['one_time', 'monthly', 'annual'] }),
    f('benefit', 'enum', 'Benefit', { enum: ['percent_off', 'free_visits', 'unlimited'] }),
    f('benefit_value', 'float', 'Benefit value'),
    f('items', 'array', 'Applies to items'),
    f('member_count', 'int', 'Members'),
    f('is_active', 'bool', 'Active'),
  ]),

  T('membership', 'Members', 'Engagement',
    'One person on one plan, with their renewal date and remaining entitlement.', [
    f('pk', 'id', 'ID'),
    f('membership_type', 'ref', 'Plan', { ref: 'membership_type' }),
    f('contact', 'ref', 'Member', { ref: 'contact' }),
    f('started_on', 'date', 'Started'),
    f('renews_on', 'date', 'Renews'),
    f('visits_used', 'int', 'Visits used'),
    f('status', 'enum', 'Status', { enum: ['active', 'lapsed', 'cancelled', 'past_due'] }),
  ]),

  /* --------------------------------------------------------------- System */
  T('api_key', 'API keys', 'System',
    'Credentials for the external API. Scoped, revocable, and individually rate-limited.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Label'),
    f('key_prefix', 'string', 'Key'),
    f('scopes', 'array', 'Scopes'),
    f('created_at', 'datetime', 'Created'),
    f('last_used', 'datetime', 'Last used'),
    f('requests_30d', 'int', 'Requests 30d'),
    f('status', 'enum', 'Status', { enum: ['active', 'revoked'] }),
  ]),

  T('webhook', 'Webhooks', 'System',
    'Outbound event subscriptions. Failed deliveries retry with backoff and surface here.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('url', 'url', 'Endpoint'),
    f('events', 'array', 'Events'),
    f('status', 'enum', 'Status', { enum: ['active', 'paused', 'failing'] }),
    f('success_rate', 'pct', 'Success rate'),
    f('last_delivery', 'datetime', 'Last delivery'),
    f('failures_24h', 'int', 'Failures 24h'),
  ]),

  T('activity_log', 'Activity log', 'System',
    'Immutable audit trail. Who changed what, when, and what the value was before.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('actor', 'ref', 'User', { ref: 'user' }),
    f('action', 'string', 'Action'),
    f('target_type', 'string', 'Object type'),
    f('target', 'string', 'Object'),
    f('detail', 'string', 'Detail'),
    f('created_at', 'datetime', 'When'),
    f('ip_address', 'string', 'IP'),
  ]),

  T('saved_report', 'Saved reports', 'System',
    'A stored report definition — columns, filters, grouping — optionally emailed on a schedule.', [
    f('pk', 'id', 'ID'),
    f('company', 'ref', 'Company', { ref: 'company' }),
    f('name', 'string', 'Report'),
    f('base', 'enum', 'Dataset', { enum: ['bookings', 'payments', 'payouts', 'items', 'contacts', 'availability'] }),
    f('columns', 'array', 'Columns'),
    f('filters', 'json', 'Filters'),
    f('group_by', 'string', 'Grouped by'),
    f('schedule', 'enum', 'Delivery', { enum: ['none', 'daily', 'weekly', 'monthly'] }),
    f('recipients', 'array', 'Emailed to'),
    f('owner', 'ref', 'Owner', { ref: 'user' }),
  ]),
];

/* -------------------------------------------------------------- helpers */
export const TABLES = Object.fromEntries(SCHEMA.map(t => [t.id, t]));
export const tableIds = () => SCHEMA.map(t => t.id);
export const table = (id) => TABLES[id];
export const field = (tableId, name) => TABLES[tableId]?.fields.find(f => f.name === name);

/** Every foreign-key edge in the model — powers the relationship diagram. */
export function relationships() {
  const edges = [];
  for (const t of SCHEMA)
    for (const fl of t.fields)
      if (fl.type === 'ref' && fl.ref) edges.push({ from: t.id, to: fl.ref, via: fl.name, label: fl.label });
  return edges;
}
/** Tables that point at `id`. */
export const dependents = (id) => relationships().filter(e => e.to === id);
