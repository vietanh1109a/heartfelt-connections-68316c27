/* eslint-disable @typescript-eslint/no-explicit-any */

// Known Netflix cookie names
const knownNetflixCookies = ["NetflixId", "SecureNetflixId", "nfvdid", "memclid", "profilesNewSession", "nfvdie", "lhpuuidh"];

function makeNetflixCookie(name: string, value: string) {
  return {
    name, value,
    domain: ".netflix.com",
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "no_restriction",
    expirationDate: Math.floor(Date.now() / 1000) + 30 * 86400,
  };
}

// Parse cookie string — supports Netscape, Name=Value, JSON array formats
export function parseCookieString(cookieString: string) {
  const cookies: any[] = [];
  if (!cookieString) return cookies;
  const trimmed = cookieString.trim();

  // Format 0: JSON array
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (c.name && c.value) cookies.push({
            name: c.name, value: c.value,
            domain: c.domain || ".netflix.com", path: c.path || "/",
            secure: c.secure !== undefined ? c.secure : true,
            httpOnly: c.httpOnly || false, sameSite: c.sameSite || "no_restriction",
            expirationDate: c.expirationDate || (Math.floor(Date.now() / 1000) + 30 * 86400),
          });
        }
        if (cookies.length > 0) return cookies;
      }
    } catch { /* fallthrough */ }
  }

  const lines = trimmed.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(s => s.trim()).filter(Boolean);
  const hasTabLine = lines.some(l => l.split("\t").length >= 7);

  // Format 2 & 3: Multi-line or single-line "Name=value"
  if (!hasTabLine) {
    const newFormat: any[] = [];
    for (const line of lines) {
      if (line.startsWith("#") || line.startsWith("//")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const name = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (name && value && knownNetflixCookies.includes(name)) {
        newFormat.push(makeNetflixCookie(name, value));
      }
    }
    if (newFormat.length > 0) return newFormat;

    // Inline semicolon-separated fallback
    if (lines.length === 1 && lines[0].includes(";")) {
      const parts = lines[0].split(";").map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        const eqIdx = part.indexOf("=");
        if (eqIdx === -1) continue;
        const name = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        const skip = ["path", "domain", "expires", "max-age", "secure", "httponly", "samesite"];
        if (!skip.includes(name.toLowerCase()) && name && value && knownNetflixCookies.includes(name)) {
          cookies.push(makeNetflixCookie(name, value));
        }
      }
      if (cookies.length > 0) return cookies;
    }
  }

  // Format 1: Netscape tab-separated
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const tabs = line.split("\t");
    if (tabs.length >= 7) {
      cookies.push({
        domain: tabs[0].trim(),
        path: tabs[2].trim(),
        secure: tabs[3].trim().toUpperCase() === "TRUE",
        expirationDate: parseInt(tabs[4].trim(), 10) || undefined,
        name: tabs[5].trim(),
        value: tabs[6].trim(),
        httpOnly: false,
      });
    }
  }
  return cookies;
}
