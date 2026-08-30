import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "resources",
  title: "Resources",
  icon: "\ud83d\ude90",
  group: "Operations",
  order: 70,
  hidden: false,
  summary: "Boats, vans, gear and guides \u2014 what exists, what is assigned to which departure, and what clashes.",
  entities: ["resource", "resource_assignment", "availability"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Resources", sub: "Boats, vans, gear and guides \u2014 what exists, what is assigned to which departure, and what clashes." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
