/** The props BlockRenderer passes to every block component. */
export default {
  block: { type: Object, required: true },
  value: { type: null, default: undefined },
  ctx: { type: Object, required: true },
  readOnly: { type: Boolean, default: false },
};
