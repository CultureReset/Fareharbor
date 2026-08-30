import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "messaging",
  title: "Messaging",
  icon: "\u2709",
  group: "Guests",
  order: 130,
  hidden: false,
  summary: "Automated confirmations, reminders and chases, plus the delivery log for every message sent.",
  entities: ["message_template", "message_log"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Messaging", sub: "Automated confirmations, reminders and chases, plus the delivery log for every message sent." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
