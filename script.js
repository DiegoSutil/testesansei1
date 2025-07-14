/**
 * @fileoverview Ponto de Entrada Principal da Aplicação (Maestro).
 * Orquestra a inicialização dos módulos, navegação e gestão de eventos globais.
 * VERSÃO ATUALIZADA: Adiciona lógica para páginas de categoria dinâmicas.
 */

// ... (todas as suas importações existentes)
import { state } from './js/state.js';
import { renderProducts } from './js/product.js';
// ... etc

// Mapeia os nomes de filtro para os títulos das páginas
const categoryTitles = {
    'perfume': 'Perfumes',
    'creme': 'Cremes',
    'body-splash': 'Body Splash',
    'decant': 'Decants'
};


// =================================================================================
// FUNÇÕES DE NAVEGAÇÃO E RENDERIZAÇÃO (ATUALIZADAS)
// =================================================================================

/**
 * Filtra e renderiza os produtos na página de produtos com base na categoria principal e subfiltros.
 * @param {string} mainCategory - A categoria principal da página (ex: 'perfume', 'creme').
 */
function applyProductPageFilters(mainCategory) {
    const productListEl = document.getElementById('product-list-produtos');
    if (!productListEl) return;

    // Obter valores dos sub-filtros (gênero, preço, ordenação)
    const subCategories = Array.from(document.querySelectorAll('#filter-sub-categories input:checked')).map(cb => cb.value);
    const maxPrice = parseInt(document.getElementById('price-range-filter').value);
    const sortBy = document.getElementById('sort-by').value;

    // 1. Filtra primeiro pela categoria principal da página
    let filteredProducts = state.allProducts.filter(p => p.category.toLowerCase() === mainCategory.toLowerCase());

    // 2. Aplica os sub-filtros de gênero
    if (subCategories.length > 0) {
        // A lógica de gênero precisa ser adaptada. Assumindo que produtos têm uma propriedade 'gender'
        // Se não tiver, você precisará adicionar essa propriedade aos seus dados de produto.
        // Ex: { name: '...', category: 'perfume', gender: 'masculino', ... }
        filteredProducts = filteredProducts.filter(p => p.gender && subCategories.includes(p.gender.toLowerCase()));
    }

    // 3. Aplica o filtro de preço
    filteredProducts = filteredProducts.filter(p => p.price <= maxPrice);

    // 4. Ordena os produtos
    switch (sortBy) {
        case 'price-asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name-asc':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }
    
    renderProducts(filteredProducts, 'product-list-produtos', true);
}


/**
 * Função central de navegação. Esconde todas as páginas e mostra a página alvo.
 * @param {string} pageId - O ID da página a ser exibida (ex: 'inicio', 'produtos').
 * @param {string|null} categoryFilter - O filtro de categoria principal a ser aplicado.
 */
function showPage(pageId, categoryFilter = null) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }

    // Atualiza o estado ativo nos links de navegação
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        // Ativa o link se a página e a categoria corresponderem
        if (link.dataset.page === pageId && link.dataset.categoryFilter === categoryFilter) {
            link.classList.add('active');
        } else if (link.dataset.page === pageId && !link.dataset.categoryFilter) {
             // Ativa links como 'Início' e 'Sobre'
            link.classList.add('active');
        }
    });
     // Garante que o link de Início fique ativo ao carregar a página
    if (pageId === 'inicio') {
        document.querySelector('.nav-link[data-page="inicio"]').classList.add('active');
    }


    // Lógica específica para cada página
    if (pageId === 'produtos' && categoryFilter) {
        const titleEl = document.getElementById('produtos-page-title');
        const subtitleEl = document.getElementById('produtos-page-subtitle');
        
        // Atualiza o título da página dinamicamente
        const title = categoryTitles[categoryFilter] || `Nossos ${categoryFilter}`;
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = `Explore nossa coleção de ${title.toLowerCase()}.`;

        // Limpa os checkboxes de sub-categoria antes de aplicar o filtro principal
        document.querySelectorAll('#filter-sub-categories input').forEach(cb => cb.checked = false);
        
        // Aplica os filtros para a categoria principal
        applyProductPageFilters(categoryFilter);

        // Atualiza o listener de filtros para a categoria atual
        const filterContainer = document.getElementById('page-produtos').querySelector('aside');
        // Remove listeners antigos para evitar múltiplas execuções
        filterContainer.replaceWith(filterContainer.cloneNode(true)); 
        document.getElementById('page-produtos').querySelector('aside').addEventListener('input', () => {
             applyProductPageFilters(categoryFilter);
        });

    } else if (pageId === 'sobre') {
        // Lógica para a página Sobre
    }
    // ... outras lógicas de página
    
    window.scrollTo(0, 0);
    if (window.AOS) {
        AOS.refresh();
    }
}
window.showPage = showPage;
