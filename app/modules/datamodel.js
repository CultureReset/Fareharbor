import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "datamodel",
  title: "Data Model",
  icon: "\ud83d\uddc4",
  group: "Reference",
  order: 260,
  hidden: false,
  summary: "Every table in the platform, its fields, and how the tables reference each other.",
  entities: [],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Data Model", sub: "Every table in the platform, its fields, and how the tables reference each other." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
