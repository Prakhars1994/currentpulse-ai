// A failed database query is not evidence that a published page was deleted.
// Throw before caching/rendering an empty result or generating noindex metadata.
export function requirePublicData(result, context = "Public content") {
  if (result?.error) {
    const error = new Error(`${context} is temporarily unavailable`, { cause: result.error });
    error.name = "PublicDataUnavailableError";
    throw error;
  }
  return result;
}
