// No per-org timezone setting exists yet - every organization using this
// app today is Ukraine-based. Single source of truth for that assumption:
// everywhere a "today"/date-range boundary or a rendered date/time needs a
// zone, it should read this constant rather than hardcode 'Europe/Kyiv' (or
// rely on the server's or browser's own timezone, which differ from this by
// deployment/environment and from each other). Revisit if this app ever
// serves organizations across more than one timezone.
export const ORG_TIMEZONE = 'Europe/Kyiv'
