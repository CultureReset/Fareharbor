import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "activity",
  title: "Activity Log",
  icon: "\ud83d\udd58",
  group: "Admin",
  order: 250,
  hidden: false,
  summary: "The immutable audit trail: who changed what, when, and from where.",
  entities: ["activity_log", "user"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Activity Log", sub: "The immutable audit trail: who changed what, when, and from where." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
