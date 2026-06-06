/**
 * Category Details Controller
 */

// DOM Elements
const resourcesGrid = document.getElementById('resources-grid');
const categoryHeading = document.getElementById('category-heading');

/**
 * Reads resources from localStorage (falling back to window.defaultResources)
 */
function getResources() {
  const local = localStorage.getItem('resourcesData');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing localStorage resourcesData in category:', e);
      localStorage.removeItem('resourcesData');
    }
  }
  
  // Initialize with defaults if empty
  if (window.defaultResources) {
    localStorage.setItem('resourcesData', JSON.stringify(window.defaultResources));
    return window.defaultResources;
  }
  
  return [];
}

/**
 * Resolves query parameters and filters resources accordingly
 */
function init() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('c');
  
  if (!category) {
    // Redirect to home if no category query param is defined
    window.location.href = './index.html';
    return;
  }

  // Update Page Title and Heading
  document.title = `${category} Resources - UI UX Resources`;
  if (categoryHeading) {
    categoryHeading.textContent = category;
  }

  // Retrieve dataset
  const allResources = getResources();
  
  // Filter resources under this category
  const filtered = allResources.filter(item => item.category.toLowerCase() === category.toLowerCase());

  // Render resources
  renderResourceCards(filtered);
}

/**
 * Renders resource cards onto the grid layout
 */
function renderResourceCards(resources) {
  resourcesGrid.innerHTML = '';
  
  if (resources.length === 0) {
    resourcesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #cce6ff;">
        <p>No resources found in this category yet. Submit one below!</p>
      </div>
    `;
    return;
  }
  
  resources.forEach(item => {
    // Create card element
    const card = document.createElement('article');
    card.className = 'category-card';
    card.setAttribute('tabindex', '0'); // Accessibility
    
    // In each card, in place of category name, show resource title.
    // In the button, instead of "View", use "Go to site".
    card.innerHTML = `
      <h2 class="category-title" style="word-break: break-word;">${item.title}</h2>
      <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration: none; width: 100%; text-align: center;" onclick="event.stopPropagation();">
        Go to site
      </a>
    `;
    
    // Clicking the card area also takes the user to the link
    const navigateToLink = () => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    };
    
    card.addEventListener('click', navigateToLink);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigateToLink();
      }
    });
    
    resourcesGrid.appendChild(card);
  });
}

// Start category page logic
document.addEventListener('DOMContentLoaded', init);
