/* Popup state follows storage; clock updates do not poll storage or the network. */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const keys = [
    'usdkrw', 'customRateValue', 'rateSource', 'lastFetchSource', 'lastFetchTime',
    'lastFetchAttemptTime', 'lastFetchStatus', 'lastFetchError', 'isEnabled',
    'binanceKoreanEnabled', 'krwOrderHelperEnabled', 'showBillionUnit', 'showTrillionUnit',
    'decimalPlaces', 'applyToAllSites', 'enabledSites', 'standardRate', 'upbitUsdt', 'upbitUsdc',
    'updateAvailable', 'updateLatestVersion', 'updateDownloadUrl'
  ];
  let state = {};
  let refreshPending = false;
  let editingCustom = false;
  let customDraft = false;
  let noticeTimer;
  const sourceButtons = [...document.querySelectorAll('.rate-source-option')];
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  $('versionLabel').textContent = `v${chrome.runtime.getManifest().version}`;

  function notify(message) {
    const notice = $('feedbackToast');
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
  }

  function clearError(input) {
    $(input.id + 'Error')?.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  function showError(input, message) {
    clearError(input);
    const error = document.createElement('span');
    error.id = input.id + 'Error';
    error.className = 'inline-error';
    error.setAttribute('role', 'alert');
    error.textContent = message;
    input.parentElement.appendChild(error);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
    input.focus();
  }

  function setMenu(expanded) {
    $('rateSourceOptions').hidden = !expanded;
    $('rateSourceOptions').classList.toggle('expanded', expanded);
    $('rateSourceToggle').classList.toggle('active', expanded);
    $('rateSourceToggle').setAttribute('aria-expanded', String(expanded));
  }

  function renderClock() {
    $('lastUpdate').textContent = PopupCore.formatRelativeTime(state.lastFetchTime);
    $('lastUpdate').title = state.lastFetchTime ? new Date(state.lastFetchTime).toLocaleString('ko-KR') : '';
    $('autoRefreshTimer').textContent = PopupCore.getRefreshTimerText(
      state.rateSource || 'usd_krw', state.lastFetchAttemptTime || state.lastFetchTime, state.lastFetchStatus
    );
  }

  function renderPremium() {
    for (const [source, price] of [['upbit_usdt', state.upbitUsdt], ['upbit_usdc', state.upbitUsdc]]) {
      const description = document.querySelector(`[data-source="${source}"] .option-desc`);
      const premium = PopupCore.calculatePremium(price, state.standardRate);
      description.textContent = premium === null ? '업비트 시세 기준' :
        `기준 환율 대비 ${premium >= 0 ? '+' : ''}${premium.toFixed(2)}% · ₩${price.toLocaleString('ko-KR')}`;
    }
  }

  function getSites() {
    return Array.isArray(state.enabledSites) ? state.enabledSites.filter(site => typeof site === 'string') : [...KrwCommon.DEFAULT_SITES];
  }

  function renderSites() {
    const list = $('sitesList');
    list.replaceChildren();
    const sites = getSites();
    if (!sites.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-sites-text';
      empty.textContent = '등록된 사이트가 없습니다. 아래에서 추가하세요.';
      list.appendChild(empty);
    }
    for (const site of sites) {
      const row = document.createElement('div');
      row.className = 'site-item';
      const name = document.createElement('span');
      name.className = 'site-name';
      name.textContent = site;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-site-btn';
      remove.textContent = '삭제';
      remove.setAttribute('aria-label', `${site} 삭제`);
      remove.disabled = state.applyToAllSites === true;
      remove.addEventListener('click', () => save({ enabledSites: getSites().filter(value => value !== site) }));
      row.append(name, remove);
      list.appendChild(row);
    }
    const all = state.applyToAllSites === true;
    $('mode-all').checked = all;
    $('mode-whitelist').checked = !all;
    $('sitesListContainer').classList.toggle('disabled', all);
    $('newSiteInput').disabled = all;
    $('addSiteBtn').disabled = all;
  }

  function render() {
    const source = state.rateSource || 'usd_krw';
    const actualSource = state.lastFetchSource || source;
    const hasRate = KrwCommon.isValidRate(state.usdkrw);
    $('rateValue').textContent = PopupCore.formatRate(state.usdkrw);
    $('rateSourceLabel').textContent = hasRate ? PopupCore.getSourceLabel(actualSource) : '환율을 확인하면 여기에 표시됩니다';
    const status = state.lastFetchStatus || 'loading';
    const indicator = $('statusIndicator');
    indicator.className = `status-indicator ${status === 'success' ? 'success' : status === 'failed' ? 'error' : 'loading'}`;
    indicator.title = status === 'success' ? '환율 확인 완료' : status === 'failed' ? '환율 갱신 실패' : '환율 확인 중';
    indicator.setAttribute('aria-label', indicator.title);
    let message = '';
    if (status === 'failed') {
      message = hasRate ? '갱신하지 못해 마지막으로 확인한 환율을 사용합니다.' : '환율을 불러오지 못했습니다. 잠시 후 다시 갱신해 주세요.';
    } else if (hasRate && actualSource !== source) {
      message = '선택한 환율을 확인하는 동안 이전 기준의 환율을 사용합니다.';
    }
    if (status !== 'loading' && hasRate && actualSource !== source) {
      message = '선택한 기준을 불러오지 못해 이전 기준의 환율을 사용합니다.';
    }
    $('rateFeedback').textContent = message;
    $('rateFeedback').hidden = !message;
    $('rateFeedback').title = state.lastFetchError || '';
    $('refreshRateBtn').disabled = refreshPending || status === 'loading';
    $('refreshRateBtn').hidden = source === 'custom';
    $('refreshRateBtn').textContent = refreshPending || status === 'loading' ? '갱신 중…' : '지금 갱신';
    document.querySelector('.refresh-icon').classList.toggle('is-refreshing', status === 'loading');

    const toggleKeys = {
      enableToggle: 'isEnabled', binanceKoreanToggle: 'binanceKoreanEnabled',
      krwOrderHelperToggle: 'krwOrderHelperEnabled', billionToggle: 'showBillionUnit', trillionToggle: 'showTrillionUnit'
    };
    for (const [id, key] of Object.entries(toggleKeys)) $(id).checked = state[key] !== false;
    $('decimalSelect').value = Number.isInteger(state.decimalPlaces) ? state.decimalPlaces : 2;
    $('decimalSelect').disabled = state.showBillionUnit === false && state.showTrillionUnit === false;
    const visibleSource = editingCustom ? 'custom' : source;
    for (const option of sourceButtons) {
      const selected = option.dataset.source === visibleSource;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
    $('customRateInputContainer').style.display = visibleSource === 'custom' ? 'flex' : 'none';
    if (!customDraft && document.activeElement !== $('customRateInput')) {
      $('customRateInput').value = state.customRateValue || '';
    }
    const hasUpdate = state.updateAvailable && state.updateDownloadUrl &&
      PopupCore.compareVersions(state.updateLatestVersion, chrome.runtime.getManifest().version) > 0;
    $('updateBanner').hidden = !hasUpdate;
    $('updateBanner').style.display = hasUpdate ? 'flex' : 'none';
    if (hasUpdate) $('updateBannerTitle').textContent = `새 버전 v${state.updateLatestVersion} 사용 가능`;
    renderClock();
    renderPremium();
  }

  async function save(updates) {
    try {
      await chrome.storage.local.set(updates);
      return true;
    } catch {
      notify('설정을 저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    }
  }

  async function refresh(force = false) {
    if (refreshPending) return;
    refreshPending = true;
    render();
    try {
      await chrome.runtime.sendMessage({ action: 'refreshRate', force });
    } catch {
      notify('환율 갱신에 연결하지 못했습니다. 확장 프로그램을 다시 열어 주세요.');
    } finally {
      refreshPending = false;
      render();
    }
  }

  $('refreshRateBtn').addEventListener('click', () => refresh(true));
  $('rateSourceToggle').addEventListener('click', () => {
    const expanded = $('rateSourceOptions').hidden;
    setMenu(expanded);
    if (expanded) sourceButtons.find(option => option.classList.contains('selected'))?.focus();
  });
  $('rateSourceOptions').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setMenu(false);
      $('rateSourceToggle').focus();
    }
  });
  for (const option of sourceButtons) option.addEventListener('click', async () => {
    const source = option.dataset.source;
    setMenu(false);
    editingCustom = source === 'custom';
    if (editingCustom) {
      render();
      $('customRateInput').focus();
      return;
    }
    const previousSource = state.lastFetchSource || state.rateSource || 'usd_krw';
    if (await save({ rateSource: source, lastFetchSource: previousSource })) await refresh();
  });

  async function saveCustomRate() {
    const rate = PopupCore.parseCustomRate($('customRateInput').value);
    if (rate === null) return showError($('customRateInput'), '0보다 큰 환율을 입력해 주세요.');
    clearError($('customRateInput'));
    editingCustom = false;
    customDraft = false;
    if (await save({
      rateSource: 'custom', customRateValue: rate,
      lastFetchSource: state.lastFetchSource || state.rateSource || 'usd_krw'
    })) {
      await refresh(true);
      notify('사용자 지정 환율을 저장했습니다.');
    }
  }
  $('saveCustomRateBtn').addEventListener('click', saveCustomRate);
  $('customRateInput').addEventListener('input', () => {
    customDraft = true;
    clearError($('customRateInput'));
  });
  $('customRateInput').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) saveCustomRate();
  });

  for (const [id, key] of Object.entries({
    enableToggle: 'isEnabled', binanceKoreanToggle: 'binanceKoreanEnabled',
    krwOrderHelperToggle: 'krwOrderHelperEnabled', billionToggle: 'showBillionUnit', trillionToggle: 'showTrillionUnit'
  })) $(id).addEventListener('change', event => save({ [key]: event.target.checked }));
  $('decimalSelect').addEventListener('change', event => save({ decimalPlaces: Number(event.target.value) }));

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const button of tabs) {
        const selected = button === tab;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const panel = $(button.dataset.tab);
        panel.hidden = !selected;
        panel.classList.toggle('active', selected);
      }
    });
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  }

  for (const [id, all] of [['mode-all', true], ['mode-whitelist', false]]) {
    $(id).addEventListener('change', () => save({ applyToAllSites: all }));
  }
  async function addSite() {
    const input = $('newSiteInput');
    const site = PopupCore.validateSite(input.value);
    if (!site) return showError(input, '올바른 도메인이나 웹 주소를 입력해 주세요.');
    const sites = getSites();
    if (sites.some(existing => PopupCore.validateSite(existing) === site)) return showError(input, '이미 등록된 사이트입니다.');
    if (await save({ enabledSites: [...sites, site] })) {
      input.value = '';
      clearError(input);
      input.focus();
    }
  }
  $('addSiteBtn').addEventListener('click', addSite);
  $('newSiteInput').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) addSite();
  });
  $('newSiteInput').addEventListener('input', () => clearError($('newSiteInput')));

  $('popOutBtn').addEventListener('click', async () => {
    try {
      await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 410, height: 700 });
      window.close();
    } catch { notify('새 창을 열지 못했습니다.'); }
  });
  $('updateBannerBtn').addEventListener('click', () => {
    if (state.updateDownloadUrl) chrome.tabs.create({ url: state.updateDownloadUrl });
  });
  for (const button of document.querySelectorAll('.copy-btn')) button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.querySelector(button.dataset.clipboardTarget).textContent.trim());
      notify('후원 주소를 복사했습니다.');
    } catch { notify('주소를 복사하지 못했습니다. 주소를 선택해 복사해 주세요.'); }
  });
  for (const button of document.querySelectorAll('.qr-btn')) button.addEventListener('click', () => {
    const image = $(button.dataset.qrTarget);
    const expanded = image.style.display === 'none';
    image.style.display = expanded ? 'flex' : 'none';
    button.classList.toggle('active', expanded);
    button.setAttribute('aria-expanded', String(expanded));
  });

  let loaded = false;
  const initialChanges = {};
  const onChanged = (changes, area) => {
    if (area !== 'local') return;
    if (!loaded) Object.assign(initialChanges, changes);
    for (const [key, change] of Object.entries(changes)) {
      if (keys.includes(key)) state[key] = change.newValue;
    }
    if (loaded && keys.some(key => changes[key])) render();
    if (loaded && (changes.enabledSites || changes.applyToAllSites)) renderSites();
  };
  chrome.storage.onChanged.addListener(onChanged);
  chrome.storage.local.get(keys).then(result => {
    state = result;
    for (const [key, change] of Object.entries(initialChanges)) state[key] = change.newValue;
    loaded = true;
    render();
    renderSites();
    refresh();
    chrome.runtime.sendMessage({ action: 'checkForUpdates' }).catch(() => {});
  }).catch(() => notify('설정을 불러오지 못했습니다. 확장 프로그램을 다시 열어 주세요.'));
  const clock = setInterval(renderClock, 1000);
  window.addEventListener('unload', () => {
    clearInterval(clock);
    clearTimeout(noticeTimer);
    chrome.storage.onChanged.removeListener(onChanged);
  });
});
