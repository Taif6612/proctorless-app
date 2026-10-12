(() => {
  const canUseExtension = () => {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
    } catch {
      return false;
    }
  };

  const safeSet = (submissionId) => {
    if (!submissionId || typeof submissionId !== 'string') return;
    if (!canUseExtension()) return;
    try {
      chrome.storage.local.set({ submissionId });
    } catch {
      // swallow if extension context invalidated
    }
  };

  try {
    window.addEventListener('message', (event) => {
      const data = event && event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'PROCTORLESS_SUBMISSION_ID' && typeof data.submissionId === 'string') {
        safeSet(data.submissionId);
      }
    }, false);

    const el = document.querySelector('[data-proctorless-submission-id]');
    const val = el ? el.getAttribute('data-proctorless-submission-id') : null;
    if (val && /^[0-9a-fA-F-]{36}$/.test(val)) {
      safeSet(val);
    }
  } catch {
    // ignore
  }
})();
