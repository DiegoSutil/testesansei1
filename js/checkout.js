/**
 * @fileoverview Lógica da Página de Checkout de Luxo com Múltiplas Etapas.
 * Inclui API de CEP, validação em tempo real e outras melhorias de UX.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */

// Estado do Checkout
let currentStep = 1;
const checkoutData = {
    info: null,
    shipping: null,
    coupon: null,
    cart: [],
    allProducts: []
};

// Elementos do DOM
const steps = {
    1: document.getElementById('step-1'),
    2: document.getElementById('step-2'),
    3: document.getElementById('step-3'),
};
const stepperItems = document.querySelectorAll('.stepper-item');
const backButton = document.getElementById('back-button');
const nextButton = document.getElementById('next-button');
const nextButtonText = document.getElementById('next-button-text');
const infoForm = document.getElementById('info-form');
const cepInput = document.getElementById('cep');

// =================================================================================
// Funções de UI e Navegação
// =================================================================================

function updateUIForStep(step) {
    Object.values(steps).forEach(el => el.classList.add('hidden', 'step-inactive'));
    if (steps[step]) {
        steps[step].classList.remove('hidden');
        setTimeout(() => steps[step].classList.remove('step-inactive'), 10);
    }

    stepperItems.forEach(item => {
        const itemStep = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');
        const circle = item.querySelector('.stepper-circle');
        if (itemStep < step) {
            item.classList.add('completed');
            circle.innerHTML = '<i data-feather="check" class="w-5 h-5"></i>';
        } else if (itemStep === step) {
            item.classList.add('active');
            circle.textContent = itemStep;
        } else {
            circle.textContent = itemStep;
        }
    });
    feather.replace();

    backButton.classList.toggle('hidden', step === 1);
    nextButtonText.textContent = step === 3 ? 'Pagar Agora' : (step === 2 ? 'Ir para Pagamento' : 'Ir para Frete');
    
    if (step > 1) renderInfoSummary(step);
    if (step === 3) renderShippingSummary();
}

function goToStep(step) {
    currentStep = step;
    updateUIForStep(currentStep);
}

function handleNextStep() {
    if (currentStep === 1 && !validateInfoForm()) return;
    if (currentStep === 2 && !validateShipping()) {
        alert('Por favor, selecione um método de envio.');
        return;
    }
    if (currentStep === 3) {
        handleFormSubmit();
        return;
    }
    goToStep(currentStep + 1);
}

function handleBackStep() {
    if (currentStep > 1) goToStep(currentStep - 1);
}

// =================================================================================
// Funções de Validação e Lógica de Formulário
// =================================================================================

function validateInfoForm() {
    let isValid = true;
    infoForm.querySelectorAll('[required]').forEach(input => {
        if (!validateInput(input)) isValid = false;
    });
    return isValid;
}

function validateInput(input) {
    const parent = input.parentElement;
    let errorMsg = parent.querySelector('.error-message');
    if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        parent.appendChild(errorMsg);
    }

    if (input.checkValidity()) {
        input.classList.remove('input-error');
        errorMsg.textContent = '';
        return true;
    } else {
        input.classList.add('input-error');
        errorMsg.textContent = input.validationMessage;
        return false;
    }
}

function validateShipping() {
    const selectedShipping = document.querySelector('input[name="shipping-option"]:checked');
    return selectedShipping !== null;
}

async function handleCepInput() {
    cepInput.value = cepInput.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2');
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length === 8) {
        const loader = document.getElementById('cep-loader');
        loader.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>';
        loader.classList.remove('hidden');
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.ok) throw new Error('CEP não encontrado');
            const data = await response.json();
            if (data.erro) throw new Error('CEP inválido');

            document.getElementById('address').value = data.logradouro || '';
            document.getElementById('neighborhood').value = data.bairro || '';
            document.getElementById('city').value = data.localidade || '';
            document.getElementById('state').value = data.uf || '';
            document.getElementById('number').focus();
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
            alert("Não foi possível encontrar o CEP. Por favor, preencha o endereço manualmente.");
        } finally {
            loader.classList.add('hidden');
        }
    }
}

// =================================================================================
// Funções de Renderização e Resumo
// =================================================================================

const formatCurrency = (value) => `R$ ${value.toFixed(2).replace('.', ',')}`;

function renderOrderSummary() {
    const { cart, allProducts, coupon } = checkoutData;
    
    const selectedShippingRadio = document.querySelector('input[name="shipping-option"]:checked');
    checkoutData.shipping = selectedShippingRadio ? JSON.parse(selectedShippingRadio.value) : null;

    const summaryContainer = document.getElementById('order-summary-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingEl = document.getElementById('summary-shipping');
    const discountLineEl = document.getElementById('summary-discount-line');
    const discountEl = document.getElementById('summary-discount');
    const totalEl = document.getElementById('summary-total');

    if (cart.length === 0) {
        summaryContainer.innerHTML = '<p>O seu carrinho está vazio.</p>';
        // Opcional: redirecionar de volta para a loja
        // window.location.href = './index.html';
        return;
    }

    summaryContainer.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        const product = allProducts.find(p => p.id === item.id);
        if (product) {
            subtotal += product.price * item.quantity;
            const itemElement = document.createElement('div');
            itemElement.className = 'flex items-center justify-between';
            itemElement.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="relative"><img src="${product.image}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md"><span class="absolute -top-2 -right-2 bg-slate-800 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">${item.quantity}</span></div>
                    <div><p class="font-semibold">${product.name}</p><p class="text-sm text-gray-500">${formatCurrency(product.price)}</p></div>
                </div>
                <p class="font-semibold">${formatCurrency(product.price * item.quantity)}</p>
            `;
            summaryContainer.appendChild(itemElement);
        }
    });

    let discountAmount = 0;
    if (coupon && coupon.discount) {
        discountAmount = subtotal * coupon.discount;
        discountEl.textContent = `- ${formatCurrency(discountAmount)}`;
        discountLineEl.classList.remove('hidden');
    } else {
        discountLineEl.classList.add('hidden');
    }

    const shippingCost = checkoutData.shipping ? checkoutData.shipping.price : 0;
    const total = subtotal - discountAmount + shippingCost;

    subtotalEl.textContent = formatCurrency(subtotal);
    shippingEl.textContent = checkoutData.shipping ? formatCurrency(shippingCost) : 'A calcular';
    totalEl.textContent = formatCurrency(total);
}

function renderInfoSummary(targetStep) {
    const formData = new FormData(infoForm);
    checkoutData.info = Object.fromEntries(formData.entries());
    
    const summaryHtml = `
        <div>
            <p class="text-sm text-gray-500">Contato</p>
            <p>${checkoutData.info.email}</p>
            <p class="text-sm text-gray-500 mt-2">Entregar em</p>
            <p>${checkoutData.info.address}, ${checkoutData.info.number} - ${checkoutData.info.city}, ${checkoutData.info.state}</p>
        </div>
        <button class="text-sm font-semibold text-black hover:underline" onclick="goToStep(1)">Editar</button>
    `;
    document.getElementById(`info-summary-step${targetStep}`).innerHTML = summaryHtml;
}

function renderShippingSummary() {
    if (!checkoutData.shipping) return;
    const summaryHtml = `
        <div>
            <p class="text-sm text-gray-500">Método de Envio</p>
            <p>${checkoutData.shipping.name} - ${formatCurrency(checkoutData.shipping.price)}</p>
        </div>
        <button class="text-sm font-semibold text-black hover:underline" onclick="goToStep(2)">Editar</button>
    `;
    document.getElementById('shipping-summary-step3').innerHTML = summaryHtml;
}

function simulateShippingCalculation() {
    const container = document.getElementById('shipping-options-container');
    setTimeout(() => {
        const options = [
            { name: 'SEDEX', price: 28.50, days: '3-5 dias úteis' },
            { name: 'PAC', price: 17.80, days: '7-12 dias úteis' }
        ];
        container.innerHTML = options.map(opt => `
            <label class="flex items-center justify-between p-4 border rounded-lg cursor-pointer has-[:checked]:bg-slate-100 has-[:checked]:border-black transition-all">
                <div class="flex items-center">
                    <input type="radio" name="shipping-option" class="h-4 w-4 text-black focus:ring-black" value='${JSON.stringify(opt)}'>
                    <div class="ml-4 text-sm">
                        <p class="font-semibold">${opt.name}</p>
                        <p class="text-gray-500">${opt.days}</p>
                    </div>
                </div>
                <span class="font-semibold">${formatCurrency(opt.price)}</span>
            </label>
        `).join('');
        container.querySelectorAll('input[name="shipping-option"]').forEach(radio => {
            radio.addEventListener('change', renderOrderSummary);
        });
    }, 1500);
}

function handleFormSubmit() {
    nextButton.disabled = true;
    nextButton.innerHTML = '<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>';
    console.log("Formulário enviado! A iniciar o processo de pagamento...", checkoutData);
    setTimeout(() => {
        alert('Pagamento processado com sucesso! (Isto é uma simulação)');
        // Limpa todos os dados relacionados ao pedido do localStorage
        localStorage.removeItem('sanseiCart');
        localStorage.removeItem('sanseiShipping');
        localStorage.removeItem('sanseiCoupon');
        localStorage.removeItem('sanseiAllProducts'); // Limpa também os produtos
        window.location.href = './index.html'; 
    }, 2000);
}

// =================================================================================
// Ponto de Entrada
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
    // FIX: Carrega todos os dados necessários do localStorage
    checkoutData.cart = JSON.parse(localStorage.getItem('sanseiCart')) || [];
    checkoutData.allProducts = JSON.parse(localStorage.getItem('sanseiAllProducts')) || [];
    checkoutData.coupon = JSON.parse(localStorage.getItem('sanseiCoupon')) || null;
    checkoutData.shipping = JSON.parse(localStorage.getItem('sanseiShipping')) || null;

    if (checkoutData.cart.length === 0) {
        alert("Seu carrinho está vazio. Redirecionando para a loja.");
        window.location.href = './index.html';
        return;
    }

    goToStep(1);
    renderOrderSummary();
    simulateShippingCalculation();
    feather.replace();

    nextButton.addEventListener('click', handleNextStep);
    backButton.addEventListener('click', handleBackStep);
    cepInput.addEventListener('input', handleCepInput);

    infoForm.querySelectorAll('[required]').forEach(input => {
        input.addEventListener('blur', () => validateInput(input));
    });
    
    const giftOption = document.getElementById('gift-option');
    const giftMessage = document.getElementById('gift-message');
    giftOption.addEventListener('change', () => {
        giftMessage.classList.toggle('hidden', !giftOption.checked);
    });
});
