const ROLES = new Set(["Reviewer", "HandlingEditor", "DataCurator", "AuthorResponse"]);
const EVENTS = new Set(["review", "editor_decision", "curation_check", "author_response", "correction"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORCID = /^0000-000[0-9]-[0-9]{4}-[0-9]{3}[0-9X]$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

/* Public review metadata is opt-in and tied to one immutable report hash.
 * Private invitations and drafts are never copied to a report. */
export function createPublicPeerReview(source, {id, hash}) {
  if (!source) return null;
  if (typeof source !== "object" || Array.isArray(source)) throw new Error("Open peer-review metadata must be an object");
  const resultHash = source.resultHash;
  if (source.reportId !== id || resultHash !== "sha256:" + hash || !HASH.test(resultHash)) {
    throw new Error("Open peer-review record does not match the immutable DGR identity and hash");
  }
  const publicEvents = (Array.isArray(source.events) ? source.events : []).filter(event => event?.public === true);
  const events = publicEvents.map(event => {
    if (!event || !UUID.test(String(event.eventId || "")) || !ROLES.has(event.role) || !EVENTS.has(event.eventType)
      || typeof event.text !== "string" || !event.text.trim() || event.text.length > 30000
      || !Number.isFinite(Date.parse(event.publishedAt))) {
      throw new Error("Public peer-review event is incomplete or invalid");
    }
    if (!["open", "anonymous"].includes(event.identityDisclosure)) throw new Error("Peer-review identity disclosure is required");
    const item = {
      eventId: event.eventId,
      role: event.role,
      eventType: event.eventType,
      publishedAt: new Date(event.publishedAt).toISOString(),
      public: true,
      text: event.text,
      identityDisclosure: event.identityDisclosure
    };
    if (event.identityDisclosure === "open") {
      if (typeof event.displayName !== "string" || !event.displayName.trim()) throw new Error("Open identity requires consent and a display name");
      item.displayName = event.displayName.trim().slice(0, 200);
      if (event.orcid) {
        const normalized = String(event.orcid).replace(/^https?:\/\/orcid\.org\//, "");
        if (!ORCID.test(normalized)) throw new Error("Invalid ORCID in public peer-review event");
        item.orcid = normalized;
      }
    }
    if (event.conflictOfInterest) item.conflictOfInterest = String(event.conflictOfInterest).slice(0, 4000);
    if (event.respondsTo) {
      if (!UUID.test(String(event.respondsTo))) throw new Error("Invalid peer-review response reference");
      item.respondsTo = event.respondsTo;
    }
    return item;
  });
  if (!events.length) return null;
  return {
    schema: "dendrogeo-open-peer-review/1",
    reportId: id,
    resultHash,
    policy: {
      name: "DendroGeo Open Review",
      version: String(source.policy?.version || "1.0"),
      identityDisclosure: events.every(e => e.identityDisclosure === "open") ? "open"
        : events.every(e => e.identityDisclosure === "anonymous") ? "anonymous" : "mixed",
      conflictDisclosureRequired: true
    },
    events
  };
}

export function peerReviewContributors(record) {
  if (!record) return [];
  return record.events
    .filter(event => event.identityDisclosure === "open" && ["Reviewer", "HandlingEditor", "DataCurator"].includes(event.role))
    .map(event => ({
      name: event.displayName,
      nameType: "Personal",
      contributorType: event.role === "HandlingEditor" ? "Editor" : event.role,
      ...(event.orcid ? {nameIdentifiers: [{
        nameIdentifier: "https://orcid.org/" + event.orcid,
        nameIdentifierScheme: "ORCID",
        schemeURI: "https://orcid.org"
      }]} : {})
    }));
}

export function renderPublicPeerReview(record, esc) {
  if (!record) return "";
  const events = record.events.map(event => {
    const identity = event.identityDisclosure === "open" ? esc(event.displayName) : "Anonim hakem";
    const role = {Reviewer: "Hakem", HandlingEditor: "Sorumlu editör", DataCurator: "Veri küratörü", AuthorResponse: "Yazar yanıtı"}[event.role];
    const date = esc(event.publishedAt.slice(0, 10));
    return '<article class="review-event"><h3>' + role + ' · ' + identity + '</h3><time datetime="' + esc(event.publishedAt) + '">' + date + '</time><p>' + esc(event.text).replace(/\n/g, "<br>") + '</p></article>';
  }).join("");
  return '<section class="report-open-review" aria-labelledby="open-review-title"><h2 id="open-review-title">Açık hakem değerlendirmesi</h2><p>Bu kayıt DendroGeo raporuna ait şeffaflık bilgisidir; dergi değerlendirmesi veya dergi kabulü anlamına gelmez.</p>' + events + '</section>';
}
