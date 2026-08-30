import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "settings",
  title: "Settings",
  icon: "\u2699",
  group: "Admin",
  order: 230,
  hidden: false,
  summary: "Company profile, locations, policies, lodgings, taxes and the rest of the configuration surface.",
  entities: ["company", "location", "cancellation_policy", "lodging", "tax_fee"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Settings", sub: "Company profile, locations, policies, lodgings, taxes and the rest of the configuration surface." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
