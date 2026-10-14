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

/** Where a lesson media item's file is: its web address, or its upload's. */
export function mediaSrc(item) {
  if (item.url) return item.url;
  if (item.mediaId && current && current.mediaUrl) {
    return current.mediaUrl(item.mediaId);
  }
  return null;
}
