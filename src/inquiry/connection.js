/**
 * The inquiry service client chosen by installInquiry (the real one or the
 * mock), for screens that call the service directly, like authoring.
 */
let current = null;

export function setInquiryApi(api) {
  current = api;
}

export function inquiryApi() {
  return current;
}
