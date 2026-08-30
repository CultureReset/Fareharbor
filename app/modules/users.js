import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "users",
  title: "Users & Roles",
  icon: "\ud83d\udc65",
  group: "Admin",
  order: 220,
  hidden: false,
  summary: "Who can log in, what each role may do, and the permission matrix behind it.",
  entities: ["user", "role"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "Users & Roles", sub: "Who can log in, what each role may do, and the permission matrix behind it." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
