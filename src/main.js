// Retrieve resources list from localStorage (or initialize with window.defaultResources fallback)
function getResourcesData() {
  const local = localStorage.getItem('resourcesData');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing localStorage resourcesData, resetting to defaults:', e);
      localStorage.removeItem('resourcesData');
    }
  }
  
  if (window.defaultResources) {
    try {
      localStorage.setItem('resourcesData', JSON.stringify(window.defaultResources));
      return window.defaultResources;
    } catch (e) {
      console.error('Failed to write default resources to localStorage:', e);
      return window.defaultResources;
    }
  }
  return [];
}

const resourcesData = getResourcesData();

// DOM Elements
const categoriesGrid = document.getElementById('categories-grid');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerCategoryTitle = document.getElementById('drawer-category-title');
const drawerResourcesContainer = document.getElementById('drawer-resources-container');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const loadingState = document.getElementById('loading-state');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQB3uRObRqHT6LcVnNwWXk09XtlwBTQO1cCWl9KbrgIXtQEasARAhXaQyjoouWox_My1J4VeFs6bJ-/pub?gid=0&single=true&output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz-DM9FwxnTqy8KJ9g2QwmoNoTSIaa2FRNX0-Zi-4m5zflRJsHS1j9iv8hZ58E9sWg/exec';

/**
 * Parses raw Google Sheet CSV output into structured resources JSON array
 */
function parseCsv(text) {
  // Strip UTF-8 BOM if present (common in Google Sheets CSV exports)
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  
  const headers = splitCsvRow(lines[0]);
  
  // Validation: Ensure headers actually contain standard category/title keys.
  // If Google redirects to an HTML error page, this check will prevent parsing failures.
  const hasRequiredHeaders = headers.some(h => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'category' || clean === 'title';
  });
  
  if (!hasRequiredHeaders) {
    throw new Error('CSV headers are invalid or missing required columns');
  }
  
  return lines.slice(1).map((line, idx) => {
    const values = splitCsvRow(line);
    const item = { id: String(idx + 1) };
    headers.forEach((header, i) => {
      const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanVal = values[i] ? values[i].replace(/^["']|["']$/g, '').trim() : '';
      item[cleanHeader] = cleanVal;
    });
    return item;
  });
}

function splitCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Fetch resources list from Google Sheets CSV and merge local submissions.
 */
async function fetchResources() {
  try {
    if (loadingState) loadingState.classList.add('active');
    
    // Fetch live Google Sheets CSV (using cache-buster timestamp query)
    const response = await fetch(CSV_URL + '&_t=' + new Date().getTime());
    if (!response.ok) throw new Error('Failed to fetch resource sheet');
    const csvText = await response.text();
    const resources = parseCsv(csvText);
    
    if (resources.length === 0) {
      throw new Error('Google Sheet returned empty data');
    }
    
    // Load local submissions (stored in localStorage) to show them immediately
    let localSubmissions = [];
    try {
      const local = localStorage.getItem('resourcesData');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          localSubmissions = parsed.filter(item => item.tag === 'Submitted');
        }
      }
    } catch (e) {
      console.error('Error merging local submissions:', e);
    }
    
    const combinedResources = [...resources, ...localSubmissions];
    try {
      localStorage.setItem('resourcesData', JSON.stringify(combinedResources));
    } catch (e) {
      console.error('Failed to cache combined resources:', e);
    }
    return combinedResources;
    
  } catch (error) {
    console.error('Error loading Google Sheet data, using localStorage/default resources fallback:', error);
    
    // Graceful self-healing fallback
    const local = localStorage.getItem('resourcesData');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse fallback resources from localStorage:', e);
        localStorage.removeItem('resourcesData');
      }
    }
    return resourcesData;
  } finally {
    if (loadingState) loadingState.classList.remove('active');
  }
}

/**
 * Initializes the web app, loads resource data, and renders the UI
 */
async function init() {
  try {
    const resources = await fetchResources();
    
    // Extract unique categories from dataset, filtering out empty or invalid categories
    const categories = [...new Set(resources.map(item => item.category).filter(Boolean))];
    
    // Render category cards
    renderCategoryCards(categories, resources);
    
    // Set up drawer close listeners
    setupDrawerListeners();

    // Set up Submission Modal listeners
    setupSubmitModal(categories);
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

/**
 * Renders the category cards onto the main grid
 */
function renderCategoryCards(categories, allResources) {
  if (!categoriesGrid) return;
  categoriesGrid.innerHTML = '';
  
  if (categories.length === 0) {
    categoriesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #cce6ff;">
        <p>No categories found. Click "Submit Resource" to add one!</p>
      </div>
    `;
    return;
  }
  
  categories.forEach(category => {
    // Create Card element
    const card = document.createElement('article');
    card.className = 'category-card';
    card.setAttribute('tabindex', '0'); // Accessibility
    
    // Create unique ID for the button to facilitate browser testing
    const buttonId = `view-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    
    card.innerHTML = `
      <h2 class="category-title">${category}</h2>
      <button class="btn-secondary" id="${buttonId}" aria-label="View ${category} resources">
        View
      </button>
    `;
    
    // Redirect to the category page with category parameter
    const viewAction = (e) => {
      e.stopPropagation();
      window.location.href = `./category.html?c=${encodeURIComponent(category)}`;
    };
    
    card.addEventListener('click', viewAction);
    
    // Keyboard navigation (Enter key views the category)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        viewAction(e);
      }
    });
    
    categoriesGrid.appendChild(card);
  });
}

/**
 * Filters resources by category and populates the details drawer/modal (drawer UI left for index fallback)
 */
function openCategoryDrawer(category, allResources) {
  if (!drawerCategoryTitle || !drawerResourcesContainer || !drawerOverlay) return;
  
  const filtered = allResources.filter(item => item.category === category);
  drawerCategoryTitle.textContent = category;
  drawerResourcesContainer.innerHTML = '';
  
  if (filtered.length === 0) {
    drawerResourcesContainer.innerHTML = '<p class="resource-desc">No resources found in this category.</p>';
  } else {
    filtered.forEach(item => {
      const resourceEl = document.createElement('div');
      resourceEl.className = 'resource-item';
      const linkId = `link-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      resourceEl.innerHTML = `
        <div class="resource-info">
          <div class="resource-top">
            <h3 class="resource-title">${item.title}</h3>
            ${item.tag ? `<span class="resource-badge">${item.tag}</span>` : ''}
          </div>
          <p class="resource-desc">${item.description}</p>
        </div>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-primary" id="${linkId}">
          Visit
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
          </svg>
        </a>
      `;
      drawerResourcesContainer.appendChild(resourceEl);
    });
  }
  
  drawerOverlay.classList.add('active');
  drawerOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    if (drawerCloseBtn) drawerCloseBtn.focus();
  }, 100);
}

/**
 * Closes the category drawer
 */
function closeCategoryDrawer() {
  if (!drawerOverlay) return;
  drawerOverlay.classList.remove('active');
  drawerOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Binds closing events to the drawer component
 */
function setupDrawerListeners() {
  if (!drawerCloseBtn || !drawerOverlay) return;
  
  drawerCloseBtn.addEventListener('click', closeCategoryDrawer);
  
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) {
      closeCategoryDrawer();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOverlay.classList.contains('active')) {
      closeCategoryDrawer();
    }
  });
}

/**
 * Binds events to the Submission Modal overlay, close triggers, and submission forms
 */
function setupSubmitModal(categories) {
  const submitBtn = document.getElementById('btn-submit-resource');
  const modalOverlay = document.getElementById('submit-modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const submitForm = document.getElementById('submit-resource-form');
  const categorySelect = document.getElementById('form-category');
  
  if (!modalOverlay) return;

  // Populate categories dropdown
  if (categorySelect) {
    categorySelect.innerHTML = categories
      .map(cat => `<option value="${cat}">${cat}</option>`)
      .join('');
  }

  // Open modal click handler
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      modalOverlay.classList.add('active');
      modalOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; // Stop background scroll
      if (categorySelect) categorySelect.focus();
    });
  }

  // Close modal function
  const closeSubmitModal = () => {
    modalOverlay.classList.remove('active');
    modalOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Reset validation states
    const urlError = document.getElementById('form-url-error');
    const urlInput = document.getElementById('form-url');
    if (urlError) {
      urlError.textContent = '';
      urlError.classList.remove('active');
    }
    if (urlInput) {
      urlInput.style.borderColor = '';
    }
    if (submitForm) submitForm.reset();
  };

  // Close triggers
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeSubmitModal);
  }

  // Backdrop click close
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeSubmitModal();
    }
  });

  // Escape key close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeSubmitModal();
    }
  });

  // Form submit handler
  if (submitForm) {
    submitForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const category = categorySelect.value;
      const title = document.getElementById('form-title').value.trim();
      const urlInput = document.getElementById('form-url');
      const url = urlInput.value.trim();
      const urlError = document.getElementById('form-url-error');
      
      // Validation: URL cannot exceed 30 characters
      if (url.length > 30) {
        if (urlError) {
          urlError.textContent = 'Link cannot exceed 30 characters.';
          urlError.classList.add('active');
        }
        urlInput.style.borderColor = '#ef4444';
        urlInput.focus();
        return; // Halt form submission
      } else {
        if (urlError) {
          urlError.textContent = '';
          urlError.classList.remove('active');
        }
        urlInput.style.borderColor = '';
      }
      
      // Disable inputs and button
      const submitBtnEl = submitForm.querySelector('button[type="submit"]');
      const inputs = submitForm.querySelectorAll('input, select');
      if (submitBtnEl) {
        submitBtnEl.disabled = true;
        submitBtnEl.textContent = 'Submitting...';
      }
      inputs.forEach(input => input.disabled = true);

      // Perform POST to Google Apps Script Web App
      fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Bypasses CORS preflight check for server-less environments
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, title, url: url || '#' })
      })
      .then(() => {
        // Append new item to local list for immediate visual confirmation
        resourcesData.push({
          id: String(resourcesData.length + 1),
          category: category,
          title: title, // Acts as Resource Name
          description: 'User-submitted resource.',
          url: url || '#',
          tag: 'Submitted'
        });

        // Save updated resources array to localStorage for persistent state sharing
        localStorage.setItem('resourcesData', JSON.stringify(resourcesData));

        // Re-render categories card list to update categories data
        const categoriesList = [...new Set(resourcesData.map(item => item.category).filter(Boolean))];
        renderCategoryCards(categoriesList, resourcesData);

        alert(`Success!\n\nThe resource "${title}" has been successfully added to the "${category}" category.`);
        closeSubmitModal();
      })
      .catch((error) => {
        console.error('Error submitting resource:', error);
        alert('There was a problem submitting your resource. Please try again.');
      })
      .finally(() => {
        // Re-enable form inputs
        if (submitBtnEl) {
          submitBtnEl.disabled = false;
          submitBtnEl.textContent = 'Submit';
        }
        inputs.forEach(input => input.disabled = false);
      });
    });
  }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
