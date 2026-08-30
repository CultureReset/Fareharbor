import { h } from '../core/dom.js';
import { pageHead, card } from '../core/ui/kit.js';

export default {
  id: "book",
  title: "New Booking",
  icon: "\uff0b",
  group: "Reference",
  order: 280,
  hidden: true,
  summary: "The internal booking flow an agent uses to take a reservation over the phone or at the desk.",
  entities: ["booking", "availability", "customer_type_rate", "payment"],
  render(ctx) {
    return h('div.page',
      pageHead({ title: "New Booking", sub: "The internal booking flow an agent uses to take a reservation over the phone or at the desk." }),
      card({ title: 'Not built yet' }, h('p.muted', 'This section is scaffolded.')));
  },
};
