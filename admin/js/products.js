/**
 * @fileoverview Módulo de Gestão de Produtos.
 * VERSÃO CORRIGIDA E ATUALIZADA
 */
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, getDoc, query, orderBy, limit, startAfter, endBefore,getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../../firebase-config.js';
import { DOMElements, showToast, showAdminConfirmationModal } from './ui.js';
import { fetchStats } from './stats.js';

// Estado da paginação
let pageQueryHistory = [null]; // Armazena o 'startAfter' de cada página
let productCurrentPage = 1;
const PRODUCTS_PER_PAGE = 10;

async function updateProductPaginationButtons() {
    DOMElements.productPageInfo.textContent = `Página ${productCurrentPage}`;
    DOMElements.prevProductPageBtn.disabled = productCurrentPage === 1;

    // Verifica se existe uma próxima página
    const lastVisible = pageQueryHistory[productCurrentPage];
    const productsRef = collection(db, "products");
    const nextQuery = query(productsRef, orderBy("name"), startAfter(lastVisible), limit(1));
    const nextSnap = await getDocs(nextQuery);
    DOMElements.nextProductPageBtn.disabled = nextSnap.empty;
}

export async function fetchAndRenderProducts(direction = 'first') {
    try {
        const productsRef = collection(db, "products");
        let q;
        const baseQuery = query(productsRef, orderBy("name"));

        if (direction === 'first') {
            productCurrentPage = 1;
            pageQueryHistory = [null];
            q = query(baseQuery, limit(PRODUCTS_PER_PAGE));
        } else if (direction === 'next') {
            productCurrentPage++;
            const lastVisible = pageQueryHistory[productCurrentPage - 1];
            q = query(baseQuery, startAfter(lastVisible), limit(PRODUCTS_PER_PAGE));
        } else if (direction === 'prev') {
            productCurrentPage--;
            const firstVisible = pageQueryHistory[productCurrentPage - 1];
            q = query(baseQuery, startAfter(firstVisible), limit(PRODUCTS_PER_PAGE));
             if (productCurrentPage === 1) { // Caso especial voltando para a primeira página
                q = query(baseQuery, limit(PRODUCTS_PER_PAGE));
            } else {
                // Para voltar, precisamos refazer a query até a página anterior
                // Esta é uma limitação do Firestore, a forma mais simples é recarregar
                return await fetchPage(productCurrentPage);
            }
        } else if (direction === 'current') {
            // FIX: Mantém o usuário na página atual após edição
            return await fetchPage(productCurrentPage);
        } else {
            return;
        }


        const documentSnapshots = await getDocs(q);

        if (documentSnapshots.empty) {
            if (direction === 'first') {
                 DOMElements.productListBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">Nenhum produto encontrado.</td></tr>';
            }
            if (direction === 'next') productCurrentPage--; // Volta a página se não houver resultados
            updateProductPaginationButtons();
            return;
        }
        
        const lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        pageQueryHistory[productCurrentPage] = lastVisibleDoc;


        renderProductList(documentSnapshots);
        await updateProductPaginationButtons();

    } catch (error) {
        handleProductFetchError(error);
    }
}

// Função auxiliar para buscar uma página específica
async function fetchPage(pageNumber) {
    const productsRef = collection(db, "products");
    const baseQuery = query(productsRef, orderBy("name"));
    let q;
    if (pageNumber === 1) {
        q = query(baseQuery, limit(PRODUCTS_PER_PAGE));
    } else {
        const previousPageLastDoc = pageQueryHistory[pageNumber - 1];
        q = query(baseQuery, startAfter(previousPageLastDoc), limit(PRODUCTS_PER_PAGE));
    }
    const documentSnapshots = await getDocs(q);
    renderProductList(documentSnapshots);
    await updateProductPaginationButtons();
}


function renderProductList(documentSnapshots) {
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
}


function handleProductFetchError(error) {
    console.error("Erro ao carregar produtos: ", error);
    if (error.code === 'failed-precondition') {
        showToast('Erro: Consulta requer um índice. Verifique o console para o link de criação.', true);
        console.error("O Firestore precisa de um índice para esta consulta. Por favor, use o link a seguir para criá-lo:", error.message);
    } else {
        showToast('Erro ao carregar produtos.', true);
    }
    DOMElements.productListBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Erro ao carregar produtos. Verifique o console.</td></tr>';
}

export function resetProductForm() {
    DOMElements.productForm.reset();
    DOMElements.productIdField.value = '';
    DOMElements.submitProductBtn.textContent = 'Adicionar Produto';
    DOMElements.cancelEditBtn.classList.add('hidden');
    DOMElements.submitProductBtn.disabled = false;
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
            DOMElements.productForm['product-notes-top'].value = product.notes_top || '';
            DOMElements.productForm['product-notes-heart'].value = product.notes_heart || '';
            DOMElements.productForm['product-notes-base'].value = product.notes_base || '';

            DOMElements.submitProductBtn.textContent = 'Salvar Alterações';
            DOMElements.cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showToast('Produto não encontrado para edição.', true);
        }
    }).catch(error => {
        console.error("Erro ao obter produto:", error);
        showToast('Erro ao carregar dados do produto.', true);
    });
}

export async function handleProductFormSubmit(e) {
    e.preventDefault();
    DOMElements.submitProductBtn.disabled = true;

    const productId = DOMElements.productIdField.value;
    const productData = {
        name: DOMElements.productForm['product-name'].value,
        price: parseFloat(DOMElements.productForm['product-price'].value),
        category: DOMElements.productForm['product-category'].value,
        stock: parseInt(DOMElements.productForm['product-stock'].value),
        image: DOMElements.productForm['product-image'].value,
        description: DOMElements.productForm['product-description'].value,
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
        // FIX: Recarrega a página atual em vez de voltar para a primeira
        await fetchAndRenderProducts(productId ? 'current' : 'first');
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
            await fetchAndRenderProducts('first'); // Após deletar, volta para a primeira página
            await fetchStats();
        } catch (error) {
            console.error("Erro ao eliminar produto: ", error);
            showToast('Erro ao eliminar produto.', true);
        }
    }
}
