/**
 * download.js — hand a generated file to the person using the page.
 *
 * Two hosts, one call. Served as a normal web page, this creates an object URL
 * and clicks it. Served as a claude.ai Artifact, the frame is not allowed to
 * start a download itself, so it goes through the `downloads` capability, which
 * shows the viewer a confirmation first. Callers do not care which happened.
 */
let downloadsPromise;

function capability() {
  if (downloadsPromise === undefined) {
    downloadsPromise = window.claude?.use
      ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
      : Promise.resolve(null);
  }
  return downloadsPromise;
}

/**
 * @returns {Promise<'saved'|'declined'|'failed'>}
 *   'declined' when the viewer said no — that is a normal outcome, not an error.
 */
export async function saveFile(filename, data, mime = 'text/plain') {
  const api = await capability();

  if (api) {
    try {
      await api.save({ filename, data });
      return 'saved';
    } catch (err) {
      if (err?.code === 'declined' || err?.code === 'rate_limited') return 'declined';
      console.warn('download capability refused', err);
      return 'failed';
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch (err) {
    console.warn('download failed', err);
    return 'failed';
  }
}

/** Rows of primitives to an RFC 4180 CSV string. */
export function toCsv(headers, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n');
}
