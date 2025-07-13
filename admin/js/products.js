/**
 * @fileoverview Módulo de Gestão de Produtos.
 */
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, getDoc, query, orderBy, limit, startAfter, endBefore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../../firebase-config.js';
import { DOMElements, showToast, showAdminConfirmationModal } from './ui.js';
import { fetchStats } from './stats.js';

// Estado da paginação
let lastVisibleProduct = null;
let firstVisibleProduct = null;
let productCurrentPage = 1;
const PRODUCTS_PER_PAGE = 10;

async function updateProductPaginationButtons() {
    DOMElements.productPageInfo.textContent = `Página ${productCurrentPage}`;
    DOMElements.prevProductPageBtn.disabled = productCurrentPage === 1;

    const productsRef = collection(db, "products");
    // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
    // O Firestore exige um índice composto para consultas que usam orderBy e startAfter.
    // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
    const nextQuery = query(productsRef, orderBy("name"), startAfter(lastVisibleProduct), limit(1));
    const nextSnap = await getDocs(nextQuery);
    DOMElements.nextProductPageBtn.disabled = nextSnap.empty;
}

export async function fetchAndRenderProducts(direction = 'first') {
    try {
        const productsRef = collection(db, "products");
        let q;
        // ATENÇÃO: Para esta consulta funcionar, você precisará criar um índice no Firestore.
        // O Firestore exige um índice composto para consultas que usam orderBy.
        // Se a consulta falhar, o console do Firebase fornecerá um link para criar o índice necessário.
        const baseQuery = query(productsRef, orderBy("name"));

        switch (direction) {
            case 'first':
                productCurrentPage = 1;
                q = query(baseQuery, limit(PRODUCTS_PER_PAGE));
                break;
            case 'next':
                if (!lastVisibleProduct) return;
                productCurrentPage++;
                q = query(baseQuery, startAfter(lastVisibleProduct), limit(PRODUCTS_PER_PAGE));
                break;
            case 'prev':
                if (!firstVisibleProduct) return;
                productCurrentPage--;
                q = query(baseQuery, endBefore(firstVisibleProduct), limit(PRODUCTS_PER_PAGE));
                break;
            default: return;
        }

        const documentSnapshots = await getDocs(q);
        if (documentSnapshots.empty && direction !== 'first') {
            if (direction === 'next') productCurrentPage--;
            showToast("Não há mais produtos para mostrar.", true);
            DOMElements.nextProductPageBtn.disabled = true;
            return;
        }

        if (documentSnapshots.empty && direction === 'first') {
            DOMElements.productListBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">Nenhum produto encontrado.</td></tr>';
            DOMElements.prevProductPageBtn.disabled = true;
            DOMElements.nextProductPageBtn.disabled = true;
            return;
        }

        firstVisibleProduct = documentSnapshots.docs[0];
        lastVisibleProduct = documentSnapshots.docs[documentSnapshots.docs.length - 1];

        DOMElements.productListBody.innerHTML = '';
        documentSnapshots.docs.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-2 px-2"><img src="${product.image}" alt="${product.name}" class="w-12 h-12 object-cover rounded-md" loading="lazy"></td>
                <td class="py-3 px-2">${product.name}</td>
                <td class="py-3 px-2 capitalize">${product.category}</td>
                <td class="py-3 px-2">R$ ${product.price.toFixed(2)}</td>
                <td class="py-3 px-2">${product.stock}</td>
                <td class="py-3 px-2 flex gap-2 items-center">
                    <button class="edit-btn text-blue-500 hover:text-blue-700" data-id="${product.id}" aria-label="Editar produto ${product.name}"><i data-feather="edit-2" class="w-5 h-5"></i></button>
                    <button class="delete-btn text-red-500 hover:text-red-700" data-id="${product.id}" aria-label="Deletar produto ${product.name}"><i data-feather="trash-2" class="w-5 h-5"></i></button>
                </td>`;
            DOMElements.productListBody.appendChild(row);
        });
        feather.replace();
        await updateProductPaginationButtons();
    } catch (error) {
        console.error("Erro ao carregar produtos: ", error);
        // Exibe uma mensagem de erro mais detalhada para o admin, incluindo a necessidade de criar um índice.
        if (error.code === 'failed-precondition') {
            showToast('Erro: Consulta requer um índice. Verifique o console para o link de criação.', true);
            console.error("O Firestore precisa de um índice para esta consulta. Por favor, use o link a seguir para criá-lo:", error.message);
        } else {
            showToast('Erro ao carregar produtos.', true);
        }
        DOMElements.productListBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Erro ao carregar produtos. Verifique o console para detalhes.</td></tr>';
    }
}


export function resetProductForm() {
    DOMElements.productForm.reset();
    DOMElements.productIdField.value = '';
    DOMElements.submitProductBtn.textContent = 'Adicionar Produto';
    DOMElements.cancelEditBtn.classList.add('hidden');
    DOMElements.submitProductBtn.disabled = false;
    document.querySelectorAll('.validation-error-message').forEach(el => el.remove());
}

export function populateProductForm(productId) {
    const productRef = doc(db, "products", productId);
    getDoc(productRef).then(docSnap => {
        if (docSnap.exists()) {
            const product = docSnap.data();
            DOMElements.productIdField.value = productId;
            DOMElements.productForm['product-name'].value = product.name || '';
            DOMElements.productForm['product-price'].value = product.price || '';
            DOMElements.productForm['product-category'].value = product.category || '';
            DOMElements.productForm['product-stock'].value = product.stock || '0';
            DOMElements.productForm['product-image'].value = product.image || '';
            DOMElements.productForm['product-description'].value = product.description || '';
            // Popula os campos da pirâmide olfativa
            DOMElements.productForm['product-notes-top'].value = product.notes_top || '';
            DOMElements.productForm['product-notes-heart'].value = product.notes_heart || '';
            DOMElements.productForm['product-notes-base'].value = product.notes_base || '';

            DOMElements.submitProductBtn.textContent = 'Salvar Alterações';
            DOMElements.cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.querySelectorAll('.validation-error-message').forEach(el => el.remove());
        } else {
            showToast('Produto não encontrado para edição.', true);
        }
    }).catch(error => {
        console.error("Erro ao obter produto:", error);
        showToast('Erro ao carregar dados do produto.', true);
    });
}

function validateProductForm() {
    let isValid = true;
    const form = DOMElements.productForm;
    const fields = ['product-name', 'product-price', 'product-category', 'product-stock', 'product-image'];
    document.querySelectorAll('.validation-error-message').forEach(el => el.remove());

    fields.forEach(fieldId => {
        const input = form[fieldId];
        if (!input.value.trim()) {
            isValid = false;
            const errorMessage = document.createElement('p');
            errorMessage.className = 'text-red-500 text-xs mt-1 validation-error-message';
            errorMessage.textContent = 'Este campo é obrigatório.';
            input.parentNode.appendChild(errorMessage);
        }
    });
    // Add other specific validations as before...
    return isValid;
}


export async function handleProductFormSubmit(e) {
    e.preventDefault();
    DOMElements.submitProductBtn.disabled = true;

    if (!validateProductForm()) {
        DOMElements.submitProductBtn.disabled = false;
        showToast('Por favor, corrija os erros no formulário.', true);
        return;
    }

    const productId = DOMElements.productIdField.value;
    const productData = {
        name: DOMElements.productForm['product-name'].value,
        price: parseFloat(DOMElements.productForm['product-price'].value),
        category: DOMElements.productForm['product-category'].value,
        stock: parseInt(DOMElements.productForm['product-stock'].value),
        image: DOMElements.productForm['product-image'].value,
        description: DOMElements.productForm['product-description'].value,
        // Adiciona os campos da pirâmide olfativa
        notes_top: DOMElements.productForm['product-notes-top'].value,
        notes_heart: DOMElements.productForm['product-notes-heart'].value,
        notes_base: DOMElements.productForm['product-notes-base'].value,
    };

    try {
        if (productId) {
            await updateDoc(doc(db, "products", productId), productData);
            showToast('Produto atualizado com sucesso!');
        } else {
            productData.rating = 0;
            productData.reviews = [];
            await addDoc(collection(db, "products"), productData);
            showToast('Produto adicionado com sucesso!');
        }
        resetProductForm();
        await fetchAndRenderProducts('first');
        await fetchStats();
    } catch (error) {
        console.error("Erro ao salvar produto: ", error);
        showToast('Erro ao salvar produto.', true);
    } finally {
        DOMElements.submitProductBtn.disabled = false;
    }
}

export async function deleteProduct(productId) {
    const confirmed = await showAdminConfirmationModal('Tem a certeza que quer eliminar este produto?', 'Eliminar Produto');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "products", productId));
            showToast('Produto eliminado com sucesso.');
            await fetchAndRenderProducts('first');
            await fetchStats();
        } catch (error) {
            console.error("Erro ao eliminar produto: ", error);
            showToast('Erro ao eliminar produto.', true);
        }
    }
}
