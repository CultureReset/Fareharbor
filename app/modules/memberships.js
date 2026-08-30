import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "memberships",
  title: "Memberships",
  icon: "\u2b50",
  group: "Guests",
  order: 150,
  hidden: false,
  summary: "Season passes and punch cards: plans, members, renewals and lapse risk.",
  entities: ["membership_type", "membership", "contact"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Memberships", sub: "Season passes and punch cards: plans, members, renewals and lapse risk." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
