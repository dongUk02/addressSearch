(() => {
  const REGION_DATA_PATH = './data/region-map.json';
  const SEARCH_MODE = window.appConfig?.features?.searchMode ?? 'postcode';
  const BACKEND_BASE_URL = (window.appConfig?.api?.backendBaseUrl ?? '').replace(/\/$/, '');
  const isDatasetMode = SEARCH_MODE === 'dataset';

  const form = document.getElementById('address-form');
  const sidoSelect = document.getElementById('sido-select');
  const sigunguSelect = document.getElementById('sigungu-select');
  const keywordInput = document.getElementById('keyword-input');
  const maxResultsInput = document.getElementById('max-results');
  const statusMessage = document.getElementById('status-message');
  const resultList = document.getElementById('result-list');
  const resetButton = document.getElementById('reset-button');
  const helperText = document.querySelector('[data-helper-text]');
  const helperTextPrimary = document.querySelector('[data-helper-text-primary]');
  const postcodeHelper = document.querySelector('[data-postcode-helper]');
  const postcodeLayer = document.getElementById('postcode-layer');
  const postcodeContainer = document.getElementById('postcode-container');
  const closeLayerButton = document.getElementById('close-layer');

  const state = {
    results: [],
    regionMap: {},
    selectedSidoName: '',
    selectedSigunguName: '',
    loading: false,
    activePostcode: null
  };

  document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    prepareHelperText();
    renderResultList();
    loadRegionMap();
  });

  function attachEventListeners() {
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
    if (sidoSelect) {
      sidoSelect.addEventListener('change', handleSidoChange);
    }
    if (sigunguSelect) {
      sigunguSelect.addEventListener('change', handleSigunguChange);
    }
    if (resetButton) {
      resetButton.addEventListener('click', resetAll);
    }
    if (resultList) {
      resultList.addEventListener('click', handleCopyClick);
    }
    if (closeLayerButton) {
      closeLayerButton.addEventListener('click', hidePostcodeLayer);
    }
  }

  function prepareHelperText() {
    if (!helperText || !helperTextPrimary) {
      return;
    }

    if (isDatasetMode) {
      helperTextPrimary.textContent =
        '검색 버튼을 누르면 선택한 행정구역의 공동주택 목록을 불러옵니다.';
      if (postcodeHelper) {
        postcodeHelper.style.display = 'none';
      }
    } else {
      helperTextPrimary.textContent =
        '검색 버튼을 누르면 카카오 우편번호 검색이 실행됩니다.';
      if (postcodeHelper) {
        postcodeHelper.style.display = 'inline';
      }
    }
  }

  function buildApiUrl(path, params = {}) {
    const base = BACKEND_BASE_URL || window.location.origin;
    const url = new URL(path, base);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  async function loadRegionMap() {
    setSelectLoading(sidoSelect, '광역시·도 불러오는 중...');
    if (sigunguSelect) {
      sigunguSelect.innerHTML = '<option value="">시·군·구를 선택하세요</option>';
      sigunguSelect.disabled = true;
    }

    try {
      const response = await fetch(REGION_DATA_PATH, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`failed to load region map: ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('region map payload is not an object');
      }

      state.regionMap = payload;
      populateSidoSelect();
      clearStatus();
    } catch (error) {
      console.error(error);
      setStatus('광역시·도 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.', true);
    }
  }

  function setSelectLoading(selectElement, message) {
    if (!selectElement) {
      return;
    }
    selectElement.innerHTML = `<option value="">${message}</option>`;
    selectElement.disabled = true;
  }

  function populateSidoSelect() {
    if (!sidoSelect) {
      return;
    }

    const entries = Object.keys(state.regionMap || {});
    const collator = new Intl.Collator('ko-KR');
    entries.sort(collator.compare);

    sidoSelect.innerHTML = '<option value="">광역시·도를 선택하세요</option>';
    entries.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      sidoSelect.append(option);
    });
    sidoSelect.disabled = entries.length === 0;
  }

  function handleSidoChange() {
    const selectedName = sidoSelect.value;
    state.selectedSidoName = selectedName;
    state.selectedSigunguName = '';

    if (!sigunguSelect) {
      return;
    }

    sigunguSelect.innerHTML = '<option value="">시·군·구를 선택하세요</option>';
    sigunguSelect.disabled = true;

    if (!selectedName) {
      return;
    }

    const sigunguList = Array.isArray(state.regionMap[selectedName])
      ? state.regionMap[selectedName]
      : [];

    populateSigunguSelect(sigunguList);
  }

  function populateSigunguSelect(list) {
    if (!sigunguSelect) {
      return;
    }

    const collator = new Intl.Collator('ko-KR');
    const names = Array.isArray(list)
      ? list.map((item) => String(item).trim()).filter(Boolean)
      : [];

    names.sort(collator.compare);

    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      sigunguSelect.append(option);
    });
    sigunguSelect.disabled = names.length === 0;

    if (!names.length) {
      setStatus('시·군·구 정보를 불러오지 못했습니다. 지역 데이터를 확인해주세요.', true);
    } else {
      clearStatus();
    }
  }

  function handleSigunguChange() {
    if (!sigunguSelect) {
      return;
    }
    state.selectedSigunguName = sigunguSelect.value;
    clearStatus();
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const sidoName = state.selectedSidoName;
    const sigunguName = sigunguSelect ? sigunguSelect.value : '';

    const keyword = keywordInput.value.trim();
    const max = Math.max(1, Math.min(Number(maxResultsInput.value) || 10, 1000));

    if (!sidoName) {
      setStatus('광역시·도를 선택해주세요.', true);
      return;
    }

    if (sigunguSelect && sigunguSelect.hasAttribute('required') && !sigunguName) {
      setStatus('시·군·구를 선택해주세요.', true);
      return;
    }

    state.selectedSigunguName = sigunguName;

    const options = {
      sidoName,
      sigunguName,
      keyword,
      max
    };

    if (isDatasetMode) {
      searchApartmentDataset(options);
    } else {
      openPostcodeSearch(options);
    }
  }

  function openPostcodeSearch({ sidoName, sigunguName, keyword, max }) {
    if (!window.daum || !window.daum.Postcode) {
      setStatus('카카오 우편번호 스크립트가 로드되지 않았습니다.', true);
      return;
    }

    clearStatus();
    showPostcodeLayer();

    const query = [sidoName, sigunguName, keyword].filter(Boolean).join(' ');

    state.activePostcode = new window.daum.Postcode({
      oncomplete: (data) =>
        handlePostcodeComplete(data, {
          sidoName,
          sigunguName,
          max
        }),
      onclose: (stateValue) => {
        hidePostcodeLayer();
        if (stateValue === 'FORCE_CLOSE') {
          setStatus('사용자에 의해 검색 창이 닫혔습니다.');
        }
      },
      onresize: (size) => {
        postcodeContainer.style.height = `${size.height}px`;
      }
    });

    state.activePostcode.embed(postcodeContainer, {
      autoClose: false,
      q: query
    });
  }

  async function searchApartmentDataset({ sidoName, sigunguName, keyword, max }) {
    const baseLocation = [sidoName, sigunguName].filter(Boolean).join(' ').trim();
    const query = baseLocation || keyword;

    if (!query) {
      setStatus('검색할 행정구역이나 키워드를 입력해주세요.', true);
      return;
    }

    const requestUrl = buildApiUrl('/api/apartments', {
      sidoName,
      sigunguName,
      keyword,
      max: String(max)
    });

    state.loading = true;
    setStatus('공동주택 정보를 불러오는 중입니다...');

    try {
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`apartments api failed: ${response.status}`);
      }

      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      const normalizedKeyword = keyword.replace(/\s+/g, '').toLowerCase();

      const filtered = normalizedKeyword
        ? items.filter((item) => {
            const candidates = [
              item.primaryAddress,
              item.roadAddress,
              item.jibunAddress,
              item.detailAddress,
              item.buildingName
            ];
            return candidates
              .filter(Boolean)
              .map((text) => String(text).replace(/\s+/g, '').toLowerCase())
              .some((text) => text.includes(normalizedKeyword));
          })
        : items;

      const limited = filtered.slice(0, max);
      const timestamp = Date.now();

      state.results = limited.map((item, index) => ({
        id: [sigunguName || 'all', String(timestamp), String(index)].join('-'),
        primaryAddress:
          item.primaryAddress ||
          item.roadAddress ||
          item.jibunAddress ||
          item.detailAddress ||
          '',
        buildingName: item.buildingName || '',
        postalCode: item.postalCode || '',
        detailAddress: item.detailAddress || item.jibunAddress || '',
        roadAddress: item.roadAddress || '',
        apartment: item.apartment !== false
      }));

      renderResultList();

      if (state.results.length === 0) {
        setStatus('조건과 일치하는 공동주택을 찾지 못했습니다.', true);
        return;
      }

      const resultMessage = `${baseLocation || '선택한 지역'}에서 ${
        state.results.length
      }건을 불러왔습니다.`;
      if (state.results.length < filtered.length) {
        setStatus(`${resultMessage} (최대 ${max}건까지 표시됩니다.)`);
      } else {
        setStatus(resultMessage);
      }
    } catch (error) {
      console.error(error);
      state.results = [];
      renderResultList();
      setStatus('공동주택 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.', true);
    } finally {
      state.loading = false;
    }
  }

  function handlePostcodeComplete(data, { sidoName, sigunguName, max }) {
    if (data.apartment !== 'Y') {
      setStatus('선택한 주소가 공동주택이 아닙니다. 다른 주소를 선택해주세요.', true);
      return;
    }

    const isSameSido = !sidoName || data.sido === sidoName;
    const normalizedSigungu = sigunguName?.replace(/\s+/g, '') ?? '';
    const postcodeSigungu =
      data.sigungu ||
      data.bname1 ||
      '';
    const isSameSigungu =
      !normalizedSigungu ||
      normalizedSigungu.includes(postcodeSigungu.replace(/\s+/g, ''));

    if (!isSameSido || !isSameSigungu) {
      setStatus('선택한 주소가 지정한 행정구역에 포함되지 않습니다.', true);
      return;
    }

    const added = addAddressResult(data, max);
    if (!added) {
      return;
    }

    const message = `${data.roadAddress || data.address} 주소를 추가했습니다.`;
    if (state.results.length >= max) {
      hidePostcodeLayer();
      setStatus(`${message} (최대 ${max}건까지 저장됩니다.)`);
    } else {
      setStatus(message);
    }
  }

  function addAddressResult(data, max) {
    const primaryAddress = data.roadAddress || data.address || data.jibunAddress;

    if (!primaryAddress) {
      setStatus('선택한 주소 정보를 찾을 수 없습니다.', true);
      return false;
    }

    const exists = state.results.some((item) => item.primaryAddress === primaryAddress);
    if (exists) {
      setStatus('이미 추가한 주소입니다.', true);
      return false;
    }

    const newEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      primaryAddress,
      postalCode: data.zonecode,
      buildingName: data.buildingName,
      detailAddress: data.jibunAddress,
      roadAddress: data.roadAddress,
      apartment: data.apartment === 'Y'
    };

    state.results = [newEntry, ...state.results].slice(0, max);
    renderResultList();
    return true;
  }

  function renderResultList() {
    if (!resultList) {
      return;
    }

    resultList.innerHTML = '';

    if (state.results.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'result-empty';
      emptyItem.textContent = isDatasetMode
        ? '조건에 맞는 공동주택이 없습니다.'
        : '추가한 주소가 없습니다.';
      resultList.append(emptyItem);
      return;
    }

    const template = document.getElementById('result-item-template');
    state.results.forEach((entry) => {
      const fragment = template.content.cloneNode(true);
      const listItem = fragment.querySelector('.result-item');
      listItem.dataset.id = entry.id;
      fragment.querySelector('.address-line').textContent = entry.primaryAddress;
      fragment.querySelector('.address-extra').textContent = formatExtraInfo(entry);
      resultList.append(fragment);
    });
  }

  function formatExtraInfo(entry) {
    const extraInfo = [
      entry.buildingName ? `건물명: ${entry.buildingName}` : '',
      entry.detailAddress && entry.detailAddress !== entry.primaryAddress
        ? `지번: ${entry.detailAddress}`
        : '',
      entry.postalCode ? `우편번호: ${entry.postalCode}` : '',
      typeof entry.apartment === 'boolean' ? `공동주택: ${entry.apartment ? '예' : '아니오'}` : ''
    ]
      .filter(Boolean)
      .join(' · ');

    return extraInfo || '추가 정보 없음';
  }

  async function handleCopyClick(event) {
    const button = event.target.closest('.copy-button');
    if (!button) {
      return;
    }

    const listItem = button.closest('.result-item');
    if (!listItem) {
      return;
    }

    const entry = state.results.find((item) => item.id === listItem.dataset.id);
    if (!entry) {
      setStatus('복사할 주소를 찾지 못했습니다.', true);
      return;
    }

    try {
      await navigator.clipboard.writeText(entry.primaryAddress + ' ' + entry.buildingName);
      setStatus('주소가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error(error);
      fallbackCopy(entry.primaryAddress + ' ' + entry.buildingName);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();

    try {
      const success = document.execCommand('copy');
      if (success) {
        setStatus('주소가 클립보드에 복사되었습니다.');
      } else {
        setStatus('클립보드 복사에 실패했습니다.', true);
      }
    } catch (error) {
      console.error(error);
      setStatus('클립보드 복사를 지원하지 않는 환경입니다.', true);
    } finally {
      textarea.remove();
    }
  }

  function showPostcodeLayer() {
    postcodeLayer.classList.remove('hidden');
  }

  function hidePostcodeLayer() {
    postcodeLayer.classList.add('hidden');
    postcodeContainer.innerHTML = '';
    state.activePostcode = null;
  }

  function setStatus(message, isError = false) {
    if (!statusMessage) {
      return;
    }
    statusMessage.textContent = message;
    statusMessage.classList.toggle('error', Boolean(isError));
  }

  function clearStatus() {
    if (!statusMessage) {
      return;
    }
    statusMessage.textContent = '';
    statusMessage.classList.remove('error');
  }

  function resetAll() {
    form.reset();
    state.results = [];
    state.selectedSidoName = '';
    state.selectedSigunguName = '';

    if (sidoSelect) {
      sidoSelect.selectedIndex = 0;
    }
    if (sigunguSelect) {
      sigunguSelect.innerHTML = '<option value="">시·군·구를 선택하세요</option>';
      sigunguSelect.disabled = true;
    }

    renderResultList();
    clearStatus();
    hidePostcodeLayer();
  }
})();
