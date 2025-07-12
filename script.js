// Import Firebase modules from the latest SDK
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, query, where, Timestamp, orderBy, limit, startAfter, endBefore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Import Firebase app and database instances from the centralized config
import { auth, db } from './firebase-config.js'; // Caminho corrigido

// =================================================================
// GLOBAL STATE & VARIABLES
// =================================================================
let allProducts = []; // Still store all products for search and other filters not directly using pagination
let cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
let appliedCoupon = null;
let currentUserData = null;
let allCoupons = [];
let selectedShipping = null;

// Pagination state for front-end product list (Fragrances page)
let lastVisibleProductFront = null;
let firstVisibleProductFront = null;
let productCurrentPageFront = 1;
const PRODUCTS_PER_PAGE_FRONT = 8; // Adjusted for front-end display


// =================================================================
// UTILITY FUNCTIONS
// =================================================================
function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-notification');
    if (!toastContainer) return;

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `flex items-center gap-4 px-6 py-3 mb-2 rounded-xl shadow-lg bg-white text-slate-800 border-l-4 transform transition-all duration-300 opacity-0 translate-y-10 ${isError ? 'border-red-400' : 'border-green-400'}`;
    
    const iconName = isError ? 'x-circle' : 'check-circle';
    const iconColorClass = isError ? 'text-red-500' : 'text-green-500';

    toast.innerHTML = `
        <span class="flex-shrink-0"><i data-feather="${iconName}" class="${iconColorClass}"></i></span>
        <span class="font-medium">${message}</span>
    `;

    toastContainer.appendChild(toast);
    feather.replace();

    // Animate in
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-10');
    }, 10);

    // Animate out
    setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

const showLoader = (show) => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

/**
 * Exibe um modal de confirmação personalizado.
 * @param {string} message A mensagem a ser exibida no modal.
 * @param {string} [title='Confirmação'] O título do modal.
 * @returns {Promise<boolean>} Uma promessa que resolve para `true` se o usuário confirmar, `false` caso contrário.
 */
function showConfirmationModal(message, title = 'Confirmação') {
    return new Promise(resolve => {
        const modalOverlay = document.getElementById('confirmation-modal-overlay');
        const modal = document.getElementById('confirmation-modal');
        const modalTitle = document.getElementById('confirmation-modal-title');
        const modalMessage = document.getElementById('confirmation-modal-message');
        const confirmBtn = document.getElementById('confirmation-confirm-btn');
        const cancelBtn = document.getElementById('confirmation-cancel-btn');

        if (!modalOverlay || !modal || !modalTitle || !modalMessage || !confirmBtn || !cancelBtn) {
            console.error("Elementos do modal de confirmação não encontrados. Resolvendo para false.");
            resolve(false); // Fallback to false if elements are missing
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Reset event listeners to prevent multiple bindings
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        confirmBtn.onclick = () => {
            hideConfirmationModal();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            hideConfirmationModal();
            resolve(false);
        };

        modalOverlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
    });
}

function hideConfirmationModal() {
    const modalOverlay = document.getElementById('confirmation-modal-overlay');
    const modal = document.getElementById('confirmation-modal');
    if (modalOverlay) modalOverlay.classList.add('hidden');
    if (modal) {
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}


// =================================================================
// CHECKOUT & ORDER FUNCTIONS
// =================================================================
async function handleCheckout() {
    if (!currentUserData) {
        showToast("Por favor, faça login para finalizar a compra.", true);
        toggleAuthModal(true);
        return;
    }

    if (cart.length === 0) {
        showToast("O seu carrinho está vazio.", true);
        return;
    }
    
    if (!selectedShipping) {
        showToast("Por favor, calcule e selecione uma opção de frete.", true);
        return;
    }

    showLoader(true);

    const total = calculateTotal();
    const orderItems = cart.map(item => {
        const product = allProducts.find(p => p.id === item.id);
        return {
            productId: item.id,
            name: product ? product.name : 'Produto Desconhecido', // Fallback for product name
            quantity: item.quantity,
            price: product ? product.price : 0 // Fallback for price
        };
    });

    const newOrder = {
        userId: currentUserData.uid,
        userEmail: currentUserData.email,
        items: orderItems,
        total: total,
        shipping: selectedShipping,
        status: "Pendente",
        createdAt: Timestamp.now(),
        coupon: appliedCoupon ? appliedCoupon.code : null
    };

    try {
        await addDoc(collection(db, "orders"), newOrder);
        
        // Clear cart after successful order
        cart = [];
        selectedShipping = null;
        localStorage.removeItem('sanseiCart'); // Limpa o localStorage após a finalização da compra
        await syncCartWithFirestore(); // Sincroniza o carrinho vazio com o Firestore

        showToast("Encomenda realizada com sucesso!");
        updateCartIcon();
        toggleCart(false);
        showPage('profile'); // Redirect to profile to see the new order
    } catch (error) {
        console.error("Erro ao criar encomenda: ", error);
        showToast("Ocorreu um erro ao processar a sua encomenda.", true);
    } finally {
        showLoader(false);
    }
}

function calculateSubtotal() {
    return cart.reduce((sum, item) => {
        const product = allProducts.find(p => p.id === item.id);
        return sum + (product ? product.price * item.quantity : 0);
    }, 0);
}

function calculateTotal() {
    let subtotal = calculateSubtotal();

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        subtotal -= discountAmount;
    }

    const shippingCost = selectedShipping ? selectedShipping.price : 0;

    return subtotal + shippingCost;
}


// =================================================================
// SHIPPING FUNCTIONS
// =================================================================
async function handleCalculateShipping() {
    const cepInput = document.getElementById('cep-input');
    const cep = cepInput.value.replace(/\D/g, ''); // Remove non-digits
    const btn = document.getElementById('calculate-shipping-btn');
    const btnText = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader-sm');

    if (cep.length !== 8) {
        showToast("Por favor, insira um CEP válido com 8 dígitos.", true);
        return;
    }

    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
        if (!response.ok) {
            throw new Error('CEP não encontrado ou API indisponível.');
        }
        
        // This is a simplified calculation. For real scenarios, use Correios API with package dimensions.
        const shippingOptions = [
            { Codigo: '04510', nome: 'PAC', PrazoEntrega: 10, Valor: '25,50' },
            { Codigo: '04014', nome: 'SEDEX', PrazoEntrega: 5, Valor: '45,80' }
        ];

        renderShippingOptions(shippingOptions);

    } catch (error) {
        console.error("Erro no cálculo do frete:", error);
        showToast("Não foi possível calcular o frete. Usando valores padrão.", true);
        
        // Fallback logic: If the API fails, provide default shipping options.
        const defaultShippingOptions = [
            { Codigo: '04510', nome: 'PAC (Estimado)', PrazoEntrega: 12, Valor: '28,00' },
            { Codigo: '04014', nome: 'SEDEX (Estimado)', PrazoEntrega: 7, Valor: '52,00' }
        ];
        renderShippingOptions(defaultShippingOptions);

    } finally {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        btn.disabled = false;
    }
}

function renderShippingOptions(options) {
    const container = document.getElementById('shipping-options');
    container.innerHTML = '';
    selectedShipping = null;
    renderCart(); // Recalculate total without shipping

    if (!options || options.length === 0 || options.every(opt => opt.erro)) {
         container.innerHTML = `<p class="text-red-500 text-sm">Nenhuma opção de frete encontrada para o CEP informado.</p>`;
         return;
    }

    options.forEach(option => {
        if (option.erro) return;

        const price = parseFloat(option.Valor.replace(',', '.'));
        const optionId = `shipping-${option.Codigo}`;
        const label = document.createElement('label');
        label.className = 'flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-gray-50';
        label.innerHTML = `
            <div class="flex items-center">
                <input type="radio" name="shipping-option" id="${optionId}" value="${price}" data-name="${option.nome}" class="form-radio text-gold-500" aria-label="${option.nome}, Prazo de entrega ${option.PrazoEntrega} dias úteis, Valor R$ ${price.toFixed(2).replace('.', ',')}">
                <div class="ml-3">
                    <p class="font-semibold">${option.nome}</p>
                    <p class="text-sm text-gray-500">Prazo: ${option.PrazoEntrega} dias úteis</p>
                </div>
            </div>
            <span class="font-bold">R$ ${price.toFixed(2).replace('.', ',')}</span>
        `;
        
        label.querySelector('input').addEventListener('change', () => {
            selectedShipping = {
                method: option.nome,
                price: price,
                deadline: option.PrazoEntrega
            };
            renderCart();
        });

        container.appendChild(label);
    });
}


// =================================================================
// CART FUNCTIONS (WITH FIRESTORE INTEGRATION)
// =================================================================

/**
 * Sincroniza o carrinho local com o Firestore.
 * Chamado após login, logout e qualquer alteração no carrinho.
 */
async function syncCartWithFirestore() {
    if (!currentUserData || !currentUserData.uid) {
        console.warn("DEBUG: syncCartWithFirestore - Não há usuário autenticado para sincronizar o carrinho com o Firestore.");
        return;
    }
    const userRef = doc(db, "users", currentUserData.uid);
    try {
        await updateDoc(userRef, { cart: cart });
        console.log("DEBUG: syncCartWithFirestore - Carrinho sincronizado com o Firestore com sucesso. Conteúdo do carrinho:", JSON.stringify(cart));
    } catch (error) {
        console.error("DEBUG: syncCartWithFirestore - Erro ao sincronizar carrinho com Firestore:", error);
        showToast("Erro ao salvar o carrinho.", true);
    }
}

function flyToCart(targetElement) {
    const cartIcon = document.getElementById('cart-button');
    if (!targetElement || !cartIcon) return;

    const rect = targetElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();

    const flyingImage = document.createElement('img');
    flyingImage.src = targetElement.src;
    flyingImage.className = 'fly-to-cart';
    flyingImage.style.left = `${rect.left}px`;
    flyingImage.style.top = `${rect.top}px`;
    flyingImage.style.width = `${rect.width}px`;
    flyingImage.style.height = `${rect.height}px`;
    flyingImage.style.position = 'fixed'; // Ensure it's fixed for animation
    flyingImage.style.zIndex = '100'; // Ensure it's above other elements
    flyingImage.style.transition = 'all 1s cubic-bezier(0.5, -0.5, 0.5, 1.5)'; // Adjust cubic-bezier for desired effect
    flyingImage.style.borderRadius = '50%';
    flyingImage.style.objectFit = 'cover';


    document.body.appendChild(flyingImage);

    // Force reflow to apply the initial state before the transition
    flyingImage.offsetHeight; 

    // Move to the cart
    flyingImage.style.left = `${cartRect.left + cartRect.width / 2}px`;
    flyingImage.style.top = `${cartRect.top + cartRect.height / 2}px`;
    flyingImage.style.width = '20px';
    flyingImage.style.height = '20px';
    flyingImage.style.opacity = '0';

    setTimeout(() => {
        flyingImage.remove();
    }, 1000); // Duração da animação
}


async function addToCart(productId, quantity = 1, event) {
    const button = event.target.closest('.add-to-cart-btn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="loader-sm"></span> Adicionando...'; // Enhanced feedback

    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("DEBUG: addToCart - Produto não encontrado no array allProducts:", productId);
        showToast("Erro: Produto não disponível.", true); // User-friendly error
        button.disabled = false;
        button.innerHTML = originalText;
        return;
    }
    
    const productImage = button.closest('.group') ? button.closest('.group').querySelector('img') : null;
    if (productImage) { // Ensure image exists before flying
        flyToCart(productImage);
    }

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        cartItem.quantity += quantity;
    } else {
        cart.push({ id: productId, quantity: quantity });
    }
    localStorage.setItem('sanseiCart', JSON.stringify(cart));
    console.log("DEBUG: addToCart - Carrinho atualizado no localStorage. Conteúdo:", JSON.stringify(cart));
    await syncCartWithFirestore();
    updateCartIcon();
    
    setTimeout(() => {
        showToast(`${product.name} foi adicionado ao carrinho!`);
        button.disabled = false;
        button.innerHTML = originalText;
    }, 500);
}

async function removeFromCart(productId) {
    const confirmed = await showConfirmationModal('Tem certeza que deseja remover este item do carrinho?', 'Remover do Carrinho');
    if (confirmed) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
        console.log("DEBUG: removeFromCart - Carrinho atualizado no localStorage. Conteúdo:", JSON.stringify(cart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
        showToast('Item removido do carrinho.'); // Feedback for removal
    }
}

async function updateQuantity(productId, newQuantity) {
    const cartItem = cart.find(item => item.id === productId); 
    if (!cartItem) return;
    if (newQuantity <= 0) {
        await removeFromCart(productId);
    } else {
        cartItem.quantity = newQuantity;
        localStorage.setItem('sanseiCart', JSON.stringify(cart));
        console.log("DEBUG: updateQuantity - Carrinho atualizado no localStorage. Conteúdo:", JSON.stringify(cart));
        await syncCartWithFirestore();
        updateCartIcon();
        renderCart();
    }
}

/**
 * Atualiza o contador de itens no ícone do carrinho.
 */
function updateCartIcon() {
    const cartCountEl = document.getElementById('cart-count');
    const mobileCartCountEl = document.getElementById('mobile-cart-count');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    console.log("DEBUG: updateCartIcon - Função chamada.");
    console.log("DEBUG: updateCartIcon - Array 'cart' atual:", JSON.stringify(cart));
    console.log("DEBUG: updateCartIcon - 'totalItems' calculado:", totalItems);

    if (cartCountEl) {
        cartCountEl.textContent = totalItems;
        cartCountEl.classList.toggle('hidden', totalItems === 0);
        cartCountEl.setAttribute('aria-label', `${totalItems} itens no carrinho`); // ARIA
        console.log("DEBUG: updateCartIcon - Contador do carrinho Desktop definido para:", cartCountEl.textContent);
    }
    if (mobileCartCountEl) {
        mobileCartCountEl.textContent = totalItems;
        mobileCartCountEl.classList.toggle('hidden', totalItems === 0);
        mobileCartCountEl.setAttribute('aria-label', `${totalItems} itens no carrinho`); // ARIA
        console.log("DEBUG: updateCartIcon - Contador do carrinho Mobile definido para:", mobileCartCountEl.textContent);
    }
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartSubtotalEl = document.getElementById('cart-subtotal');
    const cartTotalEl = document.getElementById('cart-total');
    const discountInfoEl = document.getElementById('discount-info');
    const shippingCostLine = document.getElementById('shipping-cost-line');
    const shippingCostEl = document.getElementById('shipping-cost');
    
    if (!cartItemsEl || !cartSubtotalEl || !cartTotalEl) {
        console.error("Elementos do carrinho não encontrados para renderização.");
        return;
    }
    
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500 text-center">Seu carrinho está vazio.</p>';
        cartSubtotalEl.textContent = 'R$ 0,00';
        cartTotalEl.textContent = 'R$ 0,00';
        shippingCostLine.classList.add('hidden');
        if(discountInfoEl) discountInfoEl.innerHTML = '';
        return;
    }
    
    let subtotal = calculateSubtotal();
    cartSubtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;

    if (appliedCoupon) {
        const discountAmount = subtotal * appliedCoupon.discount;
        subtotal -= discountAmount;
        discountInfoEl.innerHTML = `Cupom "${appliedCoupon.code}" aplicado! (-R$ ${discountAmount.toFixed(2).replace('.',',')}) <button id="remove-coupon-btn" class="text-red-500 ml-2 font-semibold" aria-label="Remover cupom">Remover</button>`;
        document.getElementById('remove-coupon-btn').addEventListener('click', removeCoupon);
    } else {
        if(discountInfoEl) discountInfoEl.innerHTML = '';
    }

    if(selectedShipping) {
        shippingCostEl.textContent = `R$ ${selectedShipping.price.toFixed(2).replace('.', ',')}`;
        shippingCostLine.classList.remove('hidden');
    } else {
        shippingCostLine.classList.add('hidden');
    }

    const total = calculateTotal();
    cartTotalEl.textContent = `R$ ${total.toFixed(2).replace('.',',')}`;
    
    cartItemsEl.innerHTML = cart.map(item => {
        const product = allProducts.find(p => p.id === item.id);
        if (!product) {
            console.warn(`Produto com ID ${item.id} não encontrado para renderização no carrinho.`);
            return ''; // Skip if product not found
        }
        return `
        <div class="flex items-center gap-4 mb-4" role="listitem">
            <img src="${product.image}" alt="${product.name}" class="w-16 h-20 object-cover rounded-md" loading="lazy">
            <div class="flex-grow">
                <h4 class="font-semibold">${product.name}</h4>
                <p class="text-sm text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <div class="flex items-center mt-2">
                    <button data-id="${item.id}" data-qty="${item.quantity - 1}" class="cart-qty-btn w-6 h-6 border rounded-md" aria-label="Diminuir quantidade de ${product.name}">-</button>
                    <span class="px-3" aria-live="polite" aria-atomic="true">${item.quantity}</span>
                    <button data-id="${item.id}" data-qty="${item.quantity + 1}" class="cart-qty-btn w-6 h-6 border rounded-md" aria-label="Aumentar quantidade de ${product.name}">+</button>
                </div>
            </div>
            <button data-id="${item.id}" class="cart-remove-btn text-red-500 hover:text-red-700" aria-label="Remover ${product.name} do carrinho"><i data-feather="trash-2" class="w-5 h-5"></i></button>
        </div>
    `}).join('');
    
    feather.replace();
}

function handleApplyCoupon(e) {
    e.preventDefault();
    const couponInput = document.getElementById('coupon-input');
    const code = couponInput.value.trim().toUpperCase();
    const coupon = allCoupons.find(c => c.code === code);

    if (coupon) {
        appliedCoupon = coupon;
        showToast(`Cupom "${code}" aplicado com sucesso!`);
        renderCart();
    } else {
        showToast('Cupom inválido.', true);
    }
    couponInput.value = '';
}

function removeCoupon() {
    appliedCoupon = null;
    renderCart();
    showToast('Cupom removido.');
}

/**
 * Alterna a visibilidade do modal do carrinho.
 * @param {boolean} show - True para mostrar, false para esconder.
 */
function toggleCart(show) {
    const cartModalOverlay = document.getElementById('cart-modal-overlay');
    const cartModal = document.getElementById('cart-modal');
    if (show) {
        cartModalOverlay.classList.remove('hidden');
        cartModal.classList.remove('translate-x-full');
        cartModal.setAttribute('aria-hidden', 'false');
        cartModalOverlay.setAttribute('aria-hidden', 'false');
        renderCart(); // Renderiza o carrinho sempre que ele é aberto
    } else {
        cartModalOverlay.classList.add('hidden');
        cartModal.classList.add('translate-x-full');
        cartModal.setAttribute('aria-hidden', 'true');
        cartModalOverlay.setAttribute('aria-hidden', 'true');
    }
}


// =================================================================
// PRODUCT & RENDERING FUNCTIONS
// =================================================================
function renderStars(rating) {
    let stars = '';
    const roundedRating = Math.round(rating); // Ensure integer for star display
    for (let i = 1; i <= 5; i++) {
        stars += `<i data-feather="star" class="feather-star ${i <= roundedRating ? 'filled' : ''}"></i>`;
    }
    return `<div class="flex items-center star-rating" role="img" aria-label="Avaliação de ${roundedRating} de 5 estrelas">${stars}</div>`;
}

function createProductCard(product, delay = 0) {
    const isInWishlist = currentUserData && currentUserData.wishlist.includes(product.id);
    return `
        <div class="bg-white group text-center rounded-lg shadow-sm flex flex-col transition-all-ease hover:-translate-y-2 hover:shadow-xl whitespace-normal flex-shrink-0 w-full sm:w-auto" data-aos="fade-up" data-aos-delay="${delay}" role="listitem">
            <div class="relative overflow-hidden rounded-t-lg">
                <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-all-ease cursor-pointer" data-id="${product.id}" loading="lazy">
                <button class="wishlist-heart absolute top-4 right-4 p-2 bg-white/70 rounded-full ${isInWishlist ? 'active' : ''}" data-id="${product.id}" aria-label="${isInWishlist ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'}">
                    <i data-feather="heart" class="w-5 h-5"></i>
                </button>
                <!-- Quick View Button -->
                <button class="quick-view-btn absolute bottom-0 left-0 right-0 bg-black/70 text-white py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" data-id="${product.id}" aria-label="Visualização rápida de ${product.name}">
                    Visualização Rápida
                </button>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <h3 class="font-heading font-semibold text-xl cursor-pointer" data-id="${product.id}">${product.name}</h3>
                <p class="text-slate-600 text-sm mb-2">${product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : ''}</p>
                <div class="flex justify-center my-2">${renderStars(product.rating)}</div>
                <p class="text-gold-500 font-bold mt-auto text-lg">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn mt-4 bg-black text-white py-2 px-6 rounded-full hover:bg-gold-500 hover:text-black transition-all-ease" data-id="${product.id}" aria-label="Adicionar ${product.name} ao carrinho">Adicionar ao Carrinho</button>
            </div>
        </div>
    `;
}

function renderProducts(productsToRender, containerId) {
    const productListEl = document.getElementById(containerId);
    if (!productListEl) {
        console.error(`Elemento com ID "${containerId}" não encontrado para renderizar produtos.`);
        return;
    }
    
    if (productsToRender.length === 0) {
        productListEl.innerHTML = `
            <div class="col-span-full text-center text-gray-600">
                <p class="text-xl mb-2">Nenhum perfume encontrado com estes filtros.</p>
                <p>Que tal tentar uma nova combinação ou ver os nossos mais vendidos?</p>
            </div>
        `;
    } else {
        // Apply cascade animations with data-aos-delay
        productListEl.innerHTML = productsToRender.map((product, index) => createProductCard(product, index * 100)).join('');
    }
    AOS.refresh();
    feather.replace();
}

async function updateProductPaginationButtonsFront() {
    const pageInfoEl = document.getElementById('product-page-info-front');
    const prevBtn = document.getElementById('prev-product-page-front');
    const nextBtn = document.getElementById('next-product-page-front');

    if (!pageInfoEl || !prevBtn || !nextBtn) {
        console.error("Elementos de paginação do front-end não encontrados.");
        return;
    }

    pageInfoEl.textContent = `Página ${productCurrentPageFront}`;
    prevBtn.disabled = productCurrentPageFront === 1;

    // Check if there's a next page
    const productsRef = collection(db, "products");
    let baseQuery = query(productsRef, orderBy("name")); // Using 'name' for consistent ordering
    
    // Apply filters to determine next page availability
    const selectedCategories = Array.from(document.querySelectorAll('#filter-cat-perfume, #filter-cat-decant, #filter-cat-masculino, #filter-cat-feminino, #filter-cat-unissex'))
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    if (selectedCategories.length > 0) {
        // Firestore only allows one 'in' clause. If multiple categories are selected,
        // it's better to fetch all and filter in JS, or use multiple queries.
        // For simplicity, if multiple categories are selected, we'll fetch all and filter in JS.
        // If only one category, we can use 'where'.
        if (selectedCategories.length === 1) {
            baseQuery = query(baseQuery, where('category', '==', selectedCategories[0]));
        } else {
            // If multiple categories are selected, we cannot use 'where' with 'in' and other filters.
            // We'll fetch all products and filter in JS. This might be inefficient for very large datasets.
            // For a more scalable solution with multiple category filters, consider a different data model or multiple queries.
            console.warn("Múltiplos filtros de categoria com paginação podem ser ineficientes. Considere otimizar a consulta ou o modelo de dados.");
        }
    }
    const priceMin = parseFloat(document.getElementById('price-min').value);
    const priceMax = parseFloat(document.getElementById('price-max').value);
    baseQuery = query(baseQuery, where('price', '>=', priceMin), where('price', '<=', priceMax));


    if (lastVisibleProductFront) {
        const nextQuery = query(baseQuery, startAfter(lastVisibleProductFront), limit(1));
        const nextSnap = await getDocs(nextQuery);
        nextBtn.disabled = nextSnap.empty;
    } else {
        // If no lastVisibleProductFront, we are on the first page, so check if there's more than one page
        const countQuery = query(baseQuery, limit(PRODUCTS_PER_PAGE_FRONT + 1)); // Fetch one more than page size
        const countSnap = await getDocs(countQuery);
        nextBtn.disabled = countSnap.size <= PRODUCTS_PER_PAGE_FRONT;
    }
}

async function applyFilters(direction = 'first') {
    showLoader(true);
    try {
        const productsRef = collection(db, "products");
        let q;
        let baseQuery = query(productsRef); // Start with a basic query

        const selectedCategories = Array.from(document.querySelectorAll('#filter-cat-perfume, #filter-cat-decant, #filter-cat-masculino, #filter-cat-feminino, #filter-cat-unissex'))
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        const priceMin = parseFloat(document.getElementById('price-min').value);
        const priceMax = parseFloat(document.getElementById('price-max').value);
        
        // Update price display
        document.getElementById('price-min-display').textContent = `R$ ${priceMin.toFixed(2).replace('.', ',')}`;
        document.getElementById('price-max-display').textContent = `R$ ${priceMax.toFixed(2).replace('.', ',')}`;
        
        const sortBy = document.getElementById('sort-by').value;
        
        // Build the Firestore query dynamically based on filters and sorting
        let firestoreQueryConstraints = [];

        // Add price range filters
        firestoreQueryConstraints.push(where('price', '>=', priceMin));
        firestoreQueryConstraints.push(where('price', '<=', priceMax));

        // Handle category filters
        let productsToFilterAndSort = [];
        if (selectedCategories.length > 0) {
            // If multiple categories, we must fetch all matching price and sort in JS
            // Firestore 'in' clause cannot be combined with range filters on other fields
            // unless composite indexes are created for every combination, which is impractical.
            // For simplicity, we'll fetch all products within price range and filter by category in JS.
            // For large datasets, this would need a more advanced strategy (e.g., multiple queries, server-side filtering).
            const allProductsInPriceRangeQuery = query(productsRef, ...firestoreQueryConstraints, orderBy("name")); // Order by name for consistent fetching
            const allProductsInPriceRangeSnapshot = await getDocs(allProductsInPriceRangeQuery);
            
            productsToFilterAndSort = allProductsInPriceRangeSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(p => selectedCategories.includes(p.category)); // Filter by category in JS
            
            // Now apply client-side pagination to this filtered set
            const startIndex = (productCurrentPageFront - 1) * PRODUCTS_PER_PAGE_FRONT;
            const endIndex = startIndex + PRODUCTS_PER_PAGE_FRONT;
            const paginatedProducts = productsToFilterAndSort.slice(startIndex, endIndex);

            lastVisibleProductFront = productsToFilterAndSort[endIndex -1]; // This is not a Firestore document, but an element for logic
            firstVisibleProductFront = productsToFilterAndSort[startIndex]; // This is not a Firestore document, but an element for logic
            
            // Manually set button states based on JS array length
            document.getElementById('prev-product-page-front').disabled = productCurrentPageFront === 1;
            document.getElementById('next-product-page-front').disabled = endIndex >= productsToFilterAndSort.length;

            productsToFilterAndSort = paginatedProducts; // Use the paginated subset
        } else {
            // If no categories selected, use Firestore pagination directly
            // Add initial orderBy for pagination
            firestoreQueryConstraints.push(orderBy("name"));

            switch (direction) {
                case 'first':
                    productCurrentPageFront = 1;
                    q = query(productsRef, ...firestoreQueryConstraints, limit(PRODUCTS_PER_PAGE_FRONT));
                    break;
                case 'next':
                    if (!lastVisibleProductFront) return;
                    productCurrentPageFront++;
                    q = query(productsRef, ...firestoreQueryConstraints, startAfter(lastVisibleProductFront), limit(PRODUCTS_PER_PAGE_FRONT));
                    break;
                case 'prev':
                    if (!firstVisibleProductFront) return;
                    productCurrentPageFront--;
                    q = query(productsRef, ...firestoreQueryConstraints, endBefore(firstVisibleProductFront), limit(PRODUCTS_PER_PAGE_FRONT));
                    break;
                default: return;
            }

            const documentSnapshots = await getDocs(q);
            if (documentSnapshots.empty) {
                if (direction === 'next') productCurrentPageFront--;
                if (direction === 'prev') productCurrentPageFront++;
                renderProducts([], 'product-list-fragrancias');
                showToast("Não há mais produtos para mostrar com estes filtros.", true);
                await updateProductPaginationButtonsFront();
                return;
            }

            firstVisibleProductFront = documentSnapshots.docs[0];
            lastVisibleProductFront = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            
            productsToFilterAndSort = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // Client-side sorting for price, popularity, and name (after fetching/filtering)
        if (sortBy === 'price-asc') {
            productsToFilterAndSort.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-desc') {
            productsToFilterAndSort.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'popularity') {
            productsToFilterAndSort.sort((a, b) => b.rating - a.rating);
        } else if (sortBy === 'name-asc') {
            productsToFilterAndSort.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'name-desc') {
            productsToFilterAndSort.sort((a, b) => b.name.localeCompare(a.name));
        }

        renderProducts(productsToFilterAndSort, 'product-list-fragrancias');
        document.getElementById('product-page-info-front').textContent = `Página ${productCurrentPageFront}`; // Update page info
        // updateProductPaginationButtonsFront is called automatically by the above logic for category filters
        if (selectedCategories.length === 0) { // Only call if Firestore pagination was used
            await updateProductPaginationButtonsFront();
        }

    } catch (error) {
        console.error("Erro ao aplicar filtros e carregar produtos:", error);
        showToast('Erro ao carregar produtos com os filtros selecionados.', true);
    } finally {
        showLoader(false);
    }
}


async function fetchAndRenderReels() {
    const reelsContainer = document.getElementById('reels-container');
    if (!reelsContainer) return;

    try {
        const reelsSnapshot = await getDocs(collection(db, "reels"));
        if (reelsSnapshot.empty) {
            reelsContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">Nenhum reel encontrado.</p>';
            return;
        }
        reelsContainer.innerHTML = ''; // Clear existing
        reelsSnapshot.forEach(doc => {
            const reel = doc.data();
            const reelElement = document.createElement('a');
            reelElement.href = reel.url;
            reelElement.target = '_blank';
            reelElement.className = 'block relative group';
            reelElement.setAttribute('aria-label', `Ver reel: ${reel.url}`); // ARIA
            reelElement.innerHTML = `
                <img src="${reel.thumbnail}" alt="Reel" class="w-full h-full object-cover rounded-lg aspect-square" loading="lazy">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all-ease flex items-center justify-center">
                    <i data-feather="play-circle" class="text-white opacity-0 group-hover:opacity-100 w-10 h-10"></i>
                </div>
            `;
            reelsContainer.appendChild(reelElement);
        });
        feather.replace();
    } catch (error) {
        console.error("Erro ao carregar reels para a página inicial:", error);
        reelsContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Não foi possível carregar os reels.</p>';
    }
}

// =================================================================
// AUTH, WISHLIST & SEARCH
// =================================================================

function renderAuthForm(isLogin = true) {
    const authContent = document.getElementById('auth-content');
    if (!authContent) return;
    let formHtml = `
        <h2 id="auth-modal-title" class="font-heading text-3xl font-bold text-center mb-6">${isLogin ? 'Login' : 'Criar Conta'}</h2>
        <div id="auth-error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 hidden" role="alert" aria-live="assertive"></div>
        <form id="auth-form">
            <div class="mb-4">
                <label for="auth-email" class="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" id="auth-email" required class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500" aria-required="true">
            </div>
            <div class="mb-4">
                <label for="auth-password" class="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
                <input type="password" id="auth-password" required minlength="6" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500" aria-required="true" aria-describedby="password-hint">
                <p id="password-hint" class="text-xs text-gray-500 mt-1">A senha deve ter no mínimo 6 caracteres.</p>
            </div>
    `;
    if (!isLogin) {
        formHtml += `
            <div class="mb-6">
                <label for="auth-confirm-password" class="block text-sm font-semibold text-gray-700 mb-2">Confirmar Senha</label>
                <input type="password" id="auth-confirm-password" required minlength="6" class="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500" aria-required="true">
            </div>
        `;
    }
    formHtml += `
            <button type="submit" class="w-full bg-gold-500 text-black font-bold py-3 rounded-md hover:bg-gold-600 transition-all-ease">
                ${isLogin ? 'Entrar' : 'Registar'}
            </button>
        </form>
        <p class="text-center text-sm mt-4">
            ${isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <a href="#" id="auth-switch" class="text-gold-500 font-semibold" aria-label="${isLogin ? 'Criar uma nova conta' : 'Fazer login em uma conta existente'}">
                ${isLogin ? 'Crie uma aqui.' : 'Faça login.'}
            </a>
        </p>
    `;
    authContent.innerHTML = formHtml;
    document.getElementById('auth-form').addEventListener('submit', isLogin ? handleLogin : handleRegister);
    document.getElementById('auth-switch').addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthForm(!isLogin);
    });
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        errorDiv.focus(); // Focus on error for accessibility
    }
}

async function handleLogin(e) {
    e.preventDefault();
    showLoader(true);
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toggleAuthModal(false);
        showToast(`Bem-vindo(a) de volta!`);
    } catch (error) {
        showAuthError('Email ou senha inválidos.');
        console.error("Erro no Login:", error);
    } finally {
        showLoader(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('auth-confirm-password').value;
    
    if (password.length < 6) {
        showAuthError('A senha deve ter no mínimo 6 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        showAuthError('As senhas não coincidem.');
        return;
    }
    showLoader(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            wishlist: [],
            cart: [] // Initialize cart in Firestore
        });
        showToast('Conta criada com sucesso! Faça login para continuar.');
        renderAuthForm(true); // Switch to login form after successful registration
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showAuthError('Este email já está registado.');
        } else {
            showAuthError('Ocorreu um erro ao criar a conta.');
        }
        console.error("Erro no Registro:", error);
    } finally {
        showLoader(false);
    }
}

async function logout() {
    await signOut(auth);
    currentUserData = null;
    cart = JSON.parse(localStorage.getItem('sanseiCart')) || []; // Revert to local cart
    updateAuthUI();
    updateCartIcon();
    showPage('inicio');
    showToast('Sessão terminada.');
}

function updateAuthUI(user) {
    const userButton = document.getElementById('user-button');
    const mobileUserLink = document.getElementById('mobile-user-link');
    const mobileBottomUserLink = document.getElementById('mobile-bottom-user-link');
    if (user) {
        userButton.onclick = () => showPage('profile');
        mobileUserLink.onclick = (e) => { e.preventDefault(); showPage('profile'); };
        mobileUserLink.textContent = 'Minha Conta';
        if (mobileBottomUserLink) {
            mobileBottomUserLink.onclick = (e) => { e.preventDefault(); showPage('profile'); };
            mobileBottomUserLink.querySelector('span').textContent = 'Conta';
            mobileBottomUserLink.setAttribute('aria-label', 'Acessar Minha Conta');
        }
    } else {
        userButton.onclick = () => toggleAuthModal(true);
        mobileUserLink.onclick = (e) => { e.preventDefault(); toggleAuthModal(true); };
        mobileUserLink.textContent = 'Login / Registar';
        if (mobileBottomUserLink) {
            mobileBottomUserLink.onclick = (e) => { e.preventDefault(); toggleAuthModal(true); };
            mobileBottomUserLink.querySelector('span').textContent = 'Login';
            mobileBottomUserLink.setAttribute('aria-label', 'Fazer Login ou Registrar');
        }
    }
}

async function toggleWishlist(productId) {
    if (!currentUserData) {
        showToast('Faça login para adicionar à lista de desejos.', true);
        toggleAuthModal(true);
        return;
    }
    const userRef = doc(db, "users", currentUserData.uid);
    const isInWishlist = currentUserData.wishlist.includes(productId);
    try {
        if (isInWishlist) {
            await updateDoc(userRef, { wishlist: arrayRemove(productId) });
            currentUserData.wishlist = currentUserData.wishlist.filter(id => id !== productId);
            showToast('Removido da lista de desejos.');
        } else {
            await updateDoc(userRef, { wishlist: arrayUnion(productId) });
            currentUserData.wishlist.push(productId);
            showToast('Adicionado à lista de desejos!');
        }
        // Re-render all visible products to update heart icons
        refreshAllProductViews();
    } catch (error) {
        console.error("Erro ao atualizar a lista de desejos:", error);
        showToast("Erro ao atualizar a lista de desejos.", true);
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) { // Check if element exists
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden'); // Hide results if query is too short
            return;
        }
        resultsContainer.classList.remove('hidden'); // Show results container

        const results = allProducts.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
        if (results.length > 0) {
            resultsContainer.innerHTML = results.map(product => `
                <a href="#" class="search-result-item flex items-center gap-4 p-2 hover:bg-gray-100 rounded-md" data-id="${product.id}" role="option" aria-label="Ver detalhes de ${product.name}">
                    <img src="${product.image}" alt="${product.name}" class="w-12 h-16 object-cover rounded" loading="lazy">
                    <div>
                        <p class="font-semibold">${product.name}</p>
                        <p class="text-sm text-gray-600">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                    </div>
                </a>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<p class="text-gray-500 p-2">Nenhum resultado encontrado.</p>';
        }
    }
}

// =================================================================
// MODAL & PAGE LOGIC
// =================================================================
function showProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Produto não encontrado para exibir detalhes:", productId);
        showToast("Detalhes do produto não disponíveis.", true);
        return;
    }

    const contentEl = document.getElementById('product-details-main-content');
    const reviewsSectionEl = document.getElementById('product-reviews-section');
    const relatedProductsSectionEl = document.getElementById('related-products-section');

    if (!contentEl || !reviewsSectionEl || !relatedProductsSectionEl) {
        console.error('Um ou mais elementos do modal de detalhes do produto não foram encontrados!');
        return;
    }

    // Main product content
    contentEl.innerHTML = `
        <div class="w-full md:w-1/2 p-8">
            <img src="${product.image}" alt="${product.name}" class="w-full h-auto object-cover rounded-lg shadow-lg" loading="lazy">
        </div>
        <div class="w-full md:w-1/2 p-8 flex flex-col">
            <h2 id="product-details-title" class="font-heading text-4xl font-bold mb-2">${product.name}</h2>
            <p class="text-slate-600 text-lg mb-2 capitalize">${product.category}</p>
            <div class="flex items-center gap-2 mb-4">
                ${renderStars(product.rating)}
                <span class="text-gray-500 text-sm">(${product.reviews ? product.reviews.length : 0} avaliações)</span>
            </div>
            <p class="text-gray-600 mb-6 text-lg leading-relaxed whitespace-pre-wrap">${product.description}</p>
            <div class="mt-auto">
                <p class="text-gold-500 font-bold text-3xl mb-6">R$ ${product.price.toFixed(2).replace('.',',')}</p>
                <button class="add-to-cart-btn w-full bg-black text-white py-3 rounded-md hover:bg-gold-500 hover:text-black transition-all-ease" data-id="${product.id}" aria-label="Adicionar ${product.name} ao carrinho">Adicionar ao Carrinho</button>
            </div>
        </div>
    `;

    // Reviews section
    if (product.reviews && product.reviews.length > 0) {
        reviewsSectionEl.innerHTML = product.reviews.map(review => `
            <div class="border-b border-gray-200 pb-4 last:border-b-0">
                <div class="flex items-center mb-2">
                    <span class="font-semibold mr-2">${review.userName}</span>
                    ${renderStars(review.rating)}
                </div>
                <p class="text-gray-700 text-sm leading-relaxed">${review.text}</p>
            </div>
        `).join('');
    } else {
        reviewsSectionEl.innerHTML = '<p class="text-gray-500">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>';
    }

    // Related products section (simple example: show other products from the same category)
    const relatedProducts = allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    if (relatedProducts.length > 0) {
        relatedProductsSectionEl.innerHTML = relatedProducts.map(p => createProductCard(p)).join('');
    } else {
        relatedProductsSectionEl.innerHTML = '<p class="text-gray-500 col-span-full">Nenhum produto relacionado encontrado.</p>';
    }


    feather.replace();
    toggleProductDetailsModal(true);
}

function toggleProductDetailsModal(show) {
    const overlay = document.getElementById('product-details-modal-overlay');
    const modal = document.getElementById('product-details-modal');
    if (show) {
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
        modal.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        modal.focus(); // Focus for accessibility
    } else {
        overlay.classList.add('hidden');
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
        modal.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function toggleAuthModal(show) {
    const overlay = document.getElementById('auth-modal-overlay');
    const modal = document.getElementById('auth-modal');
    if (show) {
        renderAuthForm();
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden', 'opacity-0', 'scale-95');
        modal.setAttribute('aria-hidden', 'false');
        overlay.setAttribute('aria-hidden', 'false');
        modal.focus(); // Focus for accessibility
    } else {
        overlay.classList.add('hidden');
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
        modal.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

// NEW: Function to toggle mobile menu
function toggleMobileMenu(show) {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (show) {
        mobileMenu.classList.remove('-translate-x-full');
        mobileMenuOverlay.classList.remove('hidden');
        mobileMenu.setAttribute('aria-expanded', 'true'); // ARIA
        mobileMenu.focus(); // Focus for accessibility
    } else {
        mobileMenu.classList.add('-translate-x-full');
        mobileMenuOverlay.classList.add('hidden');
        mobileMenu.setAttribute('aria-expanded', 'false'); // ARIA
    }
}


function handleContactFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const messageDiv = document.getElementById('contact-form-message');
    messageDiv.innerHTML = 'Obrigado pelo seu contato! Sua mensagem foi enviada com sucesso.';
    messageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700');
    messageDiv.classList.add('bg-green-100', 'text-green-700');
    form.reset();
    setTimeout(() => messageDiv.classList.add('hidden'), 5000);
}

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    showToast(`Obrigado por se inscrever, ${emailInput.value}!`);
    emailInput.value = '';
}

// =================================================================
// PAGE INITIALIZATION & NAVIGATION
// =================================================================
const pages = document.querySelectorAll('.page-content');
const navLinks = document.querySelectorAll('.nav-link');
const mobileBottomNavLinks = document.querySelectorAll('#mobile-bottom-nav .mobile-bottom-nav-link');

/**
 * Mostra uma página específica do site e atualiza os links de navegação.
 * @param {string} pageId - O ID da página a ser mostrada (ex: 'inicio', 'fragrancias').
 * @param {string} [categoryFilter=null] - Um filtro de categoria opcional para a página de fragrâncias.
 */
function showPage(pageId, categoryFilter = null) {
    console.log("DEBUG: showPage - Tentando mostrar a página:", pageId, "com filtro:", categoryFilter);
    pages.forEach(page => page.classList.add('hidden'));
    const targetPage = document.getElementById('page-' + pageId);
    if(targetPage) { 
        targetPage.classList.remove('hidden'); 
        console.log("DEBUG: showPage - Página mostrada com sucesso:", pageId);
    } else {
        console.warn("DEBUG: showPage - Elemento da página não encontrado para o ID:", pageId);
    }
    
    // Update top navigation active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });
    const activeLink = document.getElementById('nav-' + pageId);
    if(activeLink) { 
        activeLink.classList.add('active'); 
        activeLink.setAttribute('aria-current', 'page');
    }

    // Update mobile bottom navigation active state
    mobileBottomNavLinks.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });
    const activeBottomLink = document.querySelector(`#mobile-bottom-nav a[data-page="${pageId}"]`);
    if (activeBottomLink) {
        activeBottomLink.classList.add('active');
        activeBottomLink.setAttribute('aria-current', 'page');
    } else if (pageId === 'search') { // Special handling for search button
        document.getElementById('mobile-bottom-search-btn').classList.add('active');
    } else if (pageId === 'cart') { // Special handling for cart button
        document.getElementById('mobile-bottom-cart-btn').classList.add('active');
    }

    // Close mobile menu if open after navigation
    toggleMobileMenu(false);
    
    // Page-specific logic
    if (pageId === 'fragrancias') {
        // Se houver um filtro de categoria, aplique-o
        if (categoryFilter) {
            // Desmarcar todos os checkboxes de categoria primeiro
            document.querySelectorAll('#filter-cat-perfume, #filter-cat-decant, #filter-cat-masculino, #filter-cat-feminino, #filter-cat-unissex').forEach(cb => cb.checked = false);
            // Marcar o checkbox correspondente ao filtro
            const filterCheckbox = document.querySelector(`#filter-cat-${categoryFilter}`);
            if (filterCheckbox) {
                filterCheckbox.checked = true;
            }
        }
        // Reset pagination to first page when changing filters or entering page
        productCurrentPageFront = 1;
        lastVisibleProductFront = null;
        firstVisibleProductFront = null;
        applyFilters('first'); // Reaplicar filtros para refletir a nova seleção
    } else if (pageId === 'decants') {
        const decantProducts = allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        if (!currentUserData) {
            showPage('inicio');
            toggleAuthModal(true);
            return;
        }
        const profileEmailEl = document.getElementById('profile-email');
        if (profileEmailEl) {
            profileEmailEl.textContent = `Bem-vindo(a), ${currentUserData.email}`;
        }
        renderWishlist();
        renderOrders();
    }
    // Lógica para as novas páginas do menu mobile
    else if (pageId === 'homespray' || pageId === 'difusores' || pageId === 'kits' || pageId === 'mais-vendidos' || pageId === 'descontos' || pageId === 'cupom') {
        showToast(`Navegando para a página: ${pageId.replace('-', ' ').toUpperCase()}`);
    }
    
    window.scrollTo(0, 0);
    AOS.refresh();
}

async function renderWishlist() {
    const wishlistContainer = document.getElementById('wishlist-items');
    if (!currentUserData || !wishlistContainer) return;

    const wishlistProducts = allProducts.filter(p => currentUserData.wishlist.includes(p.id));
    if (wishlistProducts.length === 0) {
        wishlistContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">A sua lista de desejos está vazia.</p>';
        return;
    }
    renderProducts(wishlistProducts, 'wishlist-items');
}

async function renderOrders() {
    const ordersListContainer = document.getElementById('orders-list');
    if (!currentUserData || !ordersListContainer) return;

    // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
    // O Firestore exige um índice composto para consultas que usam where e orderBy.
    // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
    const q = query(collection(db, "orders"), where("userId", "==", currentUserData.uid), orderBy("createdAt", "desc"));
    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            ordersListContainer.innerHTML = '<p class="text-gray-500 text-center">Você ainda não fez nenhuma encomenda.</p>';
            return;
        }

        ordersListContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const order = {id: doc.id, ...doc.data()};
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
            const orderElement = document.createElement('div');
            orderElement.className = 'bg-gray-50 p-4 rounded-lg shadow-sm';
            orderElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-bold">Encomenda #${order.id.substring(0, 7)}</p>
                        <p class="text-sm text-gray-500">Data: ${orderDate}</p>
                    </div>
                    <div>
                        <p class="font-bold">Total: R$ ${order.total.toFixed(2).replace('.',',')}</p>
                        <p class="text-sm text-right font-semibold ${order.status === 'Pendente' ? 'text-yellow-500' : 'text-green-500'}">${order.status}</p>
                    </div>
                </div>
            `;
            ordersListContainer.appendChild(orderElement);
        });
    } catch (error) {
        console.error("Erro ao carregar encomendas do usuário:", error);
        ordersListContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar suas encomendas.</p>';
    }
}

function refreshAllProductViews() {
    const currentPage = document.querySelector('.page-content:not(.hidden)');
    if (!currentPage) return;
    const pageId = currentPage.id.replace('page-', '');

    if (pageId === 'inicio') {
        renderProducts(allProducts.slice(0, 4), 'product-list-home');
    } else if (pageId === 'fragrancias') {
        applyFilters('first'); // Re-apply filters and reset pagination
    } else if (pageId === 'decants') {
         const decantProducts = allProducts.filter(p => p.category === 'decant');
        renderProducts(decantProducts, 'product-list-decants');
    } else if (pageId === 'profile') {
        renderWishlist();
    }
}

async function fetchInitialData() {
    try {
        // Fetch all products for search and other non-paginated displays
        const productsSnapshot = await getDocs(collection(db, "products"));
        allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const couponsSnapshot = await getDocs(collection(db, "coupons"));
        allCoupons = couponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Render initial products for home page (first 4)
        renderProducts(allProducts.slice(0, 4), 'product-list-home');
        const navInicio = document.getElementById('nav-inicio');
        if (navInicio) {
            navInicio.classList.add('active');
        }
        
    } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showToast("Não foi possível carregar os dados do site.", true);
    }
}

function initializeEventListeners() {
    const safeAddEventListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Elemento com ID "${id}" não encontrado para adicionar listener de evento.`);
        }
    };

    safeAddEventListener('logo-link', 'click', (e) => { e.preventDefault(); showPage('inicio'); });
    document.querySelectorAll('.nav-link, .nav-link-footer, .nav-link-button').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) showPage(page);
        });
    });
    // NEW: Event listeners for mobile menu toggle
    safeAddEventListener('mobile-menu-button', 'click', () => toggleMobileMenu(true));
    safeAddEventListener('close-mobile-menu', 'click', () => toggleMobileMenu(false));
    safeAddEventListener('mobile-menu-overlay', 'click', () => toggleMobileMenu(false));

    // NEW: Event listeners for mobile nav items inside the sliding menu
    document.querySelectorAll('.mobile-nav-link').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            const categoryFilter = item.dataset.categoryFilter; // Obter o filtro de categoria
            if (page) showPage(page, categoryFilter); // Passar o filtro de categoria
            toggleMobileMenu(false); // Close menu after navigating
        });
    });


    safeAddEventListener('cart-button', 'click', () => toggleCart(true));
    safeAddEventListener('close-cart-button', 'click', () => toggleCart(false));
    safeAddEventListener('cart-modal-overlay', 'click', () => toggleCart(false));
    safeAddEventListener('checkout-button', 'click', handleCheckout);
    safeAddEventListener('calculate-shipping-btn', 'click', handleCalculateShipping);
    safeAddEventListener('close-product-details-modal', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('product-details-modal-overlay', 'click', () => toggleProductDetailsModal(false));
    safeAddEventListener('coupon-form', 'submit', handleApplyCoupon);
    safeAddEventListener('close-auth-modal', 'click', () => toggleAuthModal(false));
    safeAddEventListener('auth-modal-overlay', 'click', () => toggleAuthModal(false));
    safeAddEventListener('logout-button', 'click', logout);
    safeAddEventListener('contact-form', 'submit', handleContactFormSubmit);
    safeAddEventListener('newsletter-form', 'submit', handleNewsletterSubmit);
    safeAddEventListener('search-button-mobile', 'click', () => {
        const searchBar = document.getElementById('search-bar');
        if (searchBar) {
            searchBar.classList.toggle('hidden');
            if (!searchBar.classList.contains('hidden')) {
                document.getElementById('search-input').focus(); // Focus search input when opened
            }
        }
    });
    safeAddEventListener('close-search-bar', 'click', () => {
        const searchBar = document.getElementById('search-bar');
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        if (searchBar) searchBar.classList.add('hidden');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.innerHTML = '';
    });
    safeAddEventListener('search-input', 'keyup', handleSearch);
    safeAddEventListener('search-input-header', 'keyup', handleSearch); // Add listener for header search input
    safeAddEventListener('header-search-form', 'submit', (e) => e.preventDefault()); // Prevent form submission

    
    // New: Mobile Bottom Nav Listeners
    safeAddEventListener('mobile-bottom-search-btn', 'click', () => {
        const searchBar = document.getElementById('search-bar');
        if (searchBar) {
            searchBar.classList.toggle('hidden');
            if (!searchBar.classList.contains('hidden')) {
                document.getElementById('search-input').focus(); // Focus search input when opened
            }
        }
    });
    safeAddEventListener('mobile-bottom-cart-btn', 'click', () => toggleCart(true));
    document.querySelectorAll('#mobile-bottom-nav a[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });

    // Pagination for Fragrances page
    safeAddEventListener('prev-product-page-front', 'click', () => applyFilters('prev'));
    safeAddEventListener('next-product-page-front', 'click', () => applyFilters('next'));


    // Filter controls
    document.querySelectorAll('.filter-control').forEach(el => el.addEventListener('change', () => applyFilters('first'))); // Reset to first page on filter change
    
    // Price range slider listeners
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');
    if (priceMinInput && priceMaxInput) {
        priceMinInput.addEventListener('input', () => applyFilters('first')); // Reset to first page on price change
        priceMaxInput.addEventListener('input', () => applyFilters('first')); // Reset to first page on price change
    }


    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const icon = question.querySelector('i');
            if (answer && icon) {
                const isExpanded = question.getAttribute('aria-expanded') === 'true';
                question.setAttribute('aria-expanded', !isExpanded);
                answer.setAttribute('aria-hidden', isExpanded);

                if (answer.style.maxHeight) {
                    answer.style.maxHeight = null;
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    answer.style.maxHeight = answer.scrollHeight + "px";
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        });
    });
    document.body.addEventListener('click', (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        const wishlistHeart = e.target.closest('.wishlist-heart');
        const productLink = e.target.closest('img[data-id], h3[data-id]');
        const quickViewBtn = e.target.closest('.quick-view-btn'); // New
        const searchResult = e.target.closest('.search-result-item');
        const cartQtyBtn = e.target.closest('.cart-qty-btn');
        const cartRemoveBtn = e.target.closest('.cart-remove-btn');

        if (addToCartBtn) { e.stopPropagation(); addToCart(addToCartBtn.dataset.id, 1, e); }
        else if (wishlistHeart) { e.stopPropagation(); toggleWishlist(wishlistHeart.dataset.id); }
        else if (productLink) { e.stopPropagation(); showProductDetails(productLink.dataset.id); }
        else if (quickViewBtn) { e.stopPropagation(); showProductDetails(quickViewBtn.dataset.id); } // Handle quick view
        else if (searchResult) { e.preventDefault(); showProductDetails(searchResult.dataset.id); 
            const searchBar = document.getElementById('search-bar');
            const searchInput = document.getElementById('search-input');
            const searchResults = document.getElementById('search-results');
            if (searchBar) searchBar.classList.add('hidden');
            if (searchInput) searchInput.value = '';
            if (searchResults) searchResults.innerHTML = '';
        }
        else if (cartQtyBtn) { updateQuantity(cartQtyBtn.dataset.id, parseInt(cartQtyBtn.dataset.qty)); }
        else if (cartRemoveBtn) { removeFromCart(cartRemoveBtn.dataset.id); }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleCart(false);
            toggleProductDetailsModal(false);
            toggleAuthModal(false);
            toggleMobileMenu(false); // Close mobile menu on escape
            hideConfirmationModal(); // Close confirmation modal on escape
            // Also hide search bar if open
            const searchBar = document.getElementById('search-bar');
            if (searchBar && !searchBar.classList.contains('hidden')) {
                document.getElementById('close-search-bar').click();
            }
        }
    });
}

// =================================================================
// MAIN APP LOGIC
// =================================================================
async function main() {
    try {
        showLoader(true);
        initializeEventListeners();
        
        // Initial UI setup that doesn't depend on data
        feather.replace();
        AOS.init({ duration: 800, once: true });
        updateCartIcon(); // Initial call
        console.log("DEBUG: main - Após a chamada inicial de updateCartIcon. Carrinho Desktop:", document.getElementById('cart-count')?.textContent, "Carrinho Mobile:", document.getElementById('mobile-cart-count')?.textContent);

        // Fetch all site data first
        await Promise.all([fetchInitialData(), fetchAndRenderReels()]);

        // Now set up the auth listener
        onAuthStateChanged(auth, async (user) => {
            console.log("DEBUG: onAuthStateChanged - Estado de autenticação alterado. Usuário:", user ? user.email : "Nenhum");
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                
                let firestoreCart = [];
                if (userDoc.exists()) {
                    currentUserData = { uid: user.uid, ...userDoc.data() };
                    firestoreCart = currentUserData.cart || [];
                } else {
                    // Se o documento do usuário não existe, crie-o com um carrinho vazio
                    const newUser = { email: user.email, wishlist: [], cart: [] };
                    await setDoc(userDocRef, newUser);
                    currentUserData = { uid: user.uid, ...newUser };
                }

                const localCart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                console.log("DEBUG: onAuthStateChanged - Carrinho do Firestore:", JSON.stringify(firestoreCart));
                console.log("DEBUG: onAuthStateChanged - Carrinho do localStorage:", JSON.stringify(localCart));

                // Lógica de mesclagem aprimorada
                const mergedCartMap = new Map();

                // Adiciona itens do Firestore ao mapa
                firestoreCart.forEach(item => {
                    mergedCartMap.set(item.id, { ...item }); // Copia para evitar mutação direta
                });

                // Mescla itens do localStorage, adicionando ou atualizando quantidades
                localCart.forEach(localItem => {
                    if (mergedCartMap.has(localItem.id)) {
                        const existingItem = mergedCartMap.get(localItem.id);
                        existingItem.quantity += localItem.quantity;
                    } else {
                        mergedCartMap.set(localItem.id, { ...localItem }); // Adiciona item novo
                    }
                });

                cart = Array.from(mergedCartMap.values()); // Converte o mapa de volta para array
                localStorage.removeItem('sanseiCart'); // Limpa o localStorage após a mesclagem
                console.log("DEBUG: onAuthStateChanged - Carrinho mesclado (antes da sincronização):", JSON.stringify(cart));
                await syncCartWithFirestore(); // Sincroniza o carrinho mesclado com o Firestore

            } else {
                currentUserData = null;
                cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
                console.log("DEBUG: onAuthStateChanged - Usuário deslogado. Carrinho local:", JSON.stringify(cart));
            }
            updateAuthUI(user);
            updateCartIcon();
            console.log("DEBUG: onAuthStateChanged - Após a chamada de updateCartIcon na autenticação. Carrinho Desktop:", document.getElementById('cart-count')?.textContent, "Carrinho Mobile:", document.getElementById('mobile-cart-count')?.textContent);
            refreshAllProductViews();
        });
    } catch (error) {
        console.error("DEBUG: main - Erro crítico durante a inicialização:", error);
        showToast("Ocorreu um erro crítico ao carregar o site.", true);
    } finally {
        showLoader(false);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', main);
