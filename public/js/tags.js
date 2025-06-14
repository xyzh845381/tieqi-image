/**
 * 标签管理页面功能
 * 处理标签的创建、编辑、删除和管理
 */

document.addEventListener('DOMContentLoaded', () => {
    initTagsPage();
});

// 全局变量
let tags = [];
let filteredTags = [];
let currentSort = 'name';
let currentFilter = 'all';
let searchQuery = '';
let selectedTags = new Set();
let editingTagId = null;

// 预定义颜色
const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#71717a', '#374151', '#1f2937'
];

/**
 * 初始化标签管理页面
 */
function initTagsPage() {
    // 加载标签数据
    loadTags();

    // 初始化事件监听器
    initEventListeners();

    // 初始化颜色选择器
    initColorPicker();
}

/**
 * 加载标签数据
 */
async function loadTags() {
    try {
        showLoading();

        // 检查是否为测试模式
        const isTestMode = window.location.search.includes('test=true') || !window.location.protocol.startsWith('http');

        if (isTestMode) {
            // 测试模式：使用本地存储的模拟数据
            const savedTags = localStorage.getItem('testTags');
            if (savedTags) {
                tags = JSON.parse(savedTags);
            } else {
                tags = generateTestTags();
                localStorage.setItem('testTags', JSON.stringify(tags));
            }
        } else {
            // 生产模式：调用真实API
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch('/api/tags', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            tags = data.tags || [];
        }

        filteredTags = [...tags];

        // 更新统计信息
        updateStats();

        // 应用当前排序和过滤
        applyFiltersAndSort();

        // 渲染标签
        renderTags();

        hideLoading();
    } catch (error) {
        console.error('加载标签失败:', error);
        showError('加载标签失败，请刷新页面重试');
        hideLoading();
    }
}

// 模拟数据生成函数已移除，现在使用真实API

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // 创建标签按钮
    const createTagBtn = document.getElementById('createTagBtn');
    const emptyCreateTagBtn = document.getElementById('emptyCreateTagBtn');
    const importTagsBtn = document.getElementById('importTagsBtn');
    const exportTagsBtn = document.getElementById('exportTagsBtn');

    if (createTagBtn) {
        createTagBtn.addEventListener('click', () => openTagModal());
    }
    if (emptyCreateTagBtn) {
        emptyCreateTagBtn.addEventListener('click', () => openTagModal());
    }
    if (importTagsBtn) {
        importTagsBtn.addEventListener('click', handleImportTags);
    }
    if (exportTagsBtn) {
        exportTagsBtn.addEventListener('click', handleExportTags);
    }

    // 统计图表切换
    const statsToggleBtn = document.getElementById('statsToggleBtn');
    if (statsToggleBtn) {
        statsToggleBtn.addEventListener('click', toggleStatsChart);
    }

    // 排序下拉菜单
    initDropdown('sortDropdown', 'sortBtn', handleSortChange);

    // 过滤下拉菜单
    initDropdown('filterDropdown', 'filterBtn', handleFilterChange);

    // 标签模态框
    initTagModal();

    // 批量操作
    initBatchOperations();
}

/**
 * 初始化下拉菜单
 */
function initDropdown(dropdownId, buttonId, changeHandler) {
    const dropdown = document.getElementById(dropdownId);
    const button = document.getElementById(buttonId);

    if (dropdown && button) {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭其他下拉菜单
            document.querySelectorAll('.filter-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        });

        // 选项点击事件
        const options = dropdown.querySelectorAll('.filter-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.sort || option.dataset.filter;
                const text = option.querySelector('span').textContent.trim();
                changeHandler(value, text, option);
                dropdown.classList.remove('active');
            });
        });
    }

    // 点击外部关闭下拉菜单
    document.addEventListener('click', () => {
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    });
}

/**
 * 初始化标签模态框
 */
function initTagModal() {
    const modal = document.getElementById('tagModal');
    const closeBtn = document.getElementById('tagModalClose');
    const cancelBtn = document.getElementById('tagModalCancel');
    const form = document.getElementById('tagForm');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeTagModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeTagModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTagModal();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleTagFormSubmit);
    }
}

/**
 * 初始化批量操作
 */
function initBatchOperations() {
    const batchMerge = document.getElementById('batchMerge');
    const batchDelete = document.getElementById('batchDelete');
    const batchCancel = document.getElementById('batchCancel');

    if (batchMerge) {
        batchMerge.addEventListener('click', handleBatchMerge);
    }
    if (batchDelete) {
        batchDelete.addEventListener('click', handleBatchDelete);
    }
    if (batchCancel) {
        batchCancel.addEventListener('click', clearSelection);
    }
}

/**
 * 初始化颜色选择器
 */
function initColorPicker() {
    const colorPicker = document.getElementById('colorPicker');
    if (!colorPicker) return;

    colorPicker.innerHTML = TAG_COLORS.map(color => `
        <div class="color-option" style="background-color: ${color}" data-color="${color}"></div>
    `).join('');

    // 绑定颜色选择事件
    colorPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option')) {
            // 移除其他选中状态
            colorPicker.querySelectorAll('.color-option').forEach(option => {
                option.classList.remove('selected');
            });

            // 添加选中状态
            e.target.classList.add('selected');
        }
    });
}

/**
 * 处理搜索
 */
function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    applyFiltersAndSort();
}

/**
 * 处理排序改变
 */
function handleSortChange(sortType, sortLabel, option) {
    currentSort = sortType;

    // 更新按钮文本
    const sortBtn = document.getElementById('sortBtn');
    if (sortBtn) {
        const textSpan = sortBtn.querySelector('span');
        if (textSpan) {
            textSpan.textContent = sortLabel;
        }
    }

    // 更新活动状态
    const sortOptions = document.querySelectorAll('#sortDropdown .filter-option');
    sortOptions.forEach(opt => {
        opt.classList.toggle('active', opt === option);
    });

    applyFiltersAndSort();
}

/**
 * 处理过滤改变
 */
function handleFilterChange(filterType, filterLabel, option) {
    currentFilter = filterType;

    // 更新按钮文本
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        const textSpan = filterBtn.querySelector('span');
        if (textSpan) {
            textSpan.textContent = filterLabel;
        }
    }

    // 更新活动状态
    const filterOptions = document.querySelectorAll('#filterDropdown .filter-option');
    filterOptions.forEach(opt => {
        opt.classList.toggle('active', opt === option);
    });

    applyFiltersAndSort();
}

/**
 * 应用过滤和排序
 */
function applyFiltersAndSort() {
    // 应用搜索过滤
    filteredTags = tags.filter(tag => {
        // 搜索过滤
        if (searchQuery) {
            const searchInName = tag.name.toLowerCase().includes(searchQuery);
            const searchInDesc = tag.description.toLowerCase().includes(searchQuery);
            if (!searchInName && !searchInDesc) {
                return false;
            }
        }

        // 状态过滤
        if (currentFilter === 'used' && tag.imageCount === 0) {
            return false;
        }
        if (currentFilter === 'unused' && tag.imageCount > 0) {
            return false;
        }

        return true;
    });

    // 应用排序
    applySorting();

    // 渲染标签
    renderTags();

    // 更新统计
    updateStats();
}

/**
 * 应用排序
 */
function applySorting() {
    filteredTags.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return a.name.localeCompare(b.name, 'zh-CN');
            case 'count':
                return b.imageCount - a.imageCount;
            case 'date':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'color':
                return a.color.localeCompare(b.color);
            default:
                return a.name.localeCompare(b.name, 'zh-CN');
        }
    });
}

/**
 * 渲染标签
 */
function renderTags() {
    const grid = document.getElementById('tagsGrid');
    const emptyState = document.getElementById('emptyState');

    if (!grid || !emptyState) return;

    if (filteredTags.length === 0) {
        // 显示空状态
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    // 隐藏空状态
    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    // 渲染标签卡片
    grid.innerHTML = filteredTags.map(tag => createTagCard(tag)).join('');

    // 绑定卡片事件
    bindTagCardEvents();
}

/**
 * 创建标签卡片
 */
function createTagCard(tag) {
    const isSelected = selectedTags.has(tag.id);
    const createdDate = formatDate(tag.createdAt);

    return `
        <div class="tag-card ${isSelected ? 'selected' : ''}" data-id="${tag.id}">
            <div class="tag-header">
                <h3 class="tag-name">
                    <div class="tag-color" style="background-color: ${tag.color}"></div>
                    <span>${tag.name}</span>
                </h3>
                <div class="tag-actions">
                    <button class="tag-action-btn edit" data-id="${tag.id}" title="编辑标签">
                        <i class="ri-edit-line"></i>
                    </button>
                    <button class="tag-action-btn delete" data-id="${tag.id}" title="删除标签">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </div>

            <div class="tag-stats">
                <div class="tag-stat">
                    <i class="ri-image-line"></i>
                    <span>${tag.imageCount} 张图片</span>
                </div>
                <div class="tag-stat">
                    <i class="ri-calendar-line"></i>
                    <span>${createdDate}</span>
                </div>
            </div>

            ${tag.description ? `
            <div class="tag-description">${tag.description}</div>
            ` : ''}

            <div class="tag-images-preview">
                ${tag.images.slice(0, 4).map(img => `
                    <img src="${img.thumbnailUrl}" alt="${img.name}" class="tag-image-thumb" title="${img.name}">
                `).join('')}
                ${tag.imageCount > 4 ? `
                    <div class="tag-more-count">+${tag.imageCount - 4}</div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * 绑定标签卡片事件
 */
function bindTagCardEvents() {
    // 标签卡片选择
    const tagCards = document.querySelectorAll('.tag-card');
    tagCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // 如果点击的是操作按钮，不执行选择
            if (e.target.closest('.tag-action-btn')) {
                return;
            }

            const tagId = card.dataset.id;
            handleTagSelection(tagId, card);
        });
    });

    // 编辑按钮
    const editBtns = document.querySelectorAll('.tag-action-btn.edit');
    editBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tagId = btn.dataset.id;
            editTag(tagId);
        });
    });

    // 删除按钮
    const deleteBtns = document.querySelectorAll('.tag-action-btn.delete');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tagId = btn.dataset.id;
            deleteTag(tagId);
        });
    });

    // 图片缩略图点击事件
    const imageThumbs = document.querySelectorAll('.tag-image-thumb');
    imageThumbs.forEach(thumb => {
        thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            // 可以实现图片预览功能
            window.open(thumb.src.replace('100/100', '800/600'), '_blank');
        });
    });
}

/**
 * 处理标签选择
 */
function handleTagSelection(tagId, card) {
    if (selectedTags.has(tagId)) {
        selectedTags.delete(tagId);
        card.classList.remove('selected');
    } else {
        selectedTags.add(tagId);
        card.classList.add('selected');
    }

    updateBatchToolbar();
}

/**
 * 更新批量操作工具栏
 */
function updateBatchToolbar() {
    const toolbar = document.getElementById('batchToolbar');
    const selectedCount = document.getElementById('selectedCount');

    if (!toolbar || !selectedCount) return;

    selectedCount.textContent = selectedTags.size;

    if (selectedTags.size > 0) {
        toolbar.classList.add('active');
    } else {
        toolbar.classList.remove('active');
    }
}

/**
 * 清除选择
 */
function clearSelection() {
    selectedTags.clear();

    // 更新UI
    const tagCards = document.querySelectorAll('.tag-card');
    tagCards.forEach(card => {
        card.classList.remove('selected');
    });

    updateBatchToolbar();
}

/**
 * 打开标签模态框
 */
function openTagModal(tagId = null) {
    const modal = document.getElementById('tagModal');
    const title = document.getElementById('tagModalTitle');
    const nameInput = document.getElementById('tagName');
    const descInput = document.getElementById('tagDescription');
    const colorPicker = document.getElementById('colorPicker');
    const submitBtn = document.getElementById('tagModalSubmit');

    if (!modal) return;

    editingTagId = tagId;

    if (tagId) {
        // 编辑模式
        const tag = tags.find(t => t.id === tagId);
        if (!tag) return;

        title.textContent = '编辑标签';
        nameInput.value = tag.name;
        descInput.value = tag.description;
        submitBtn.innerHTML = '<i class="ri-save-line"></i>更新标签';

        // 选中对应颜色
        const colorOptions = colorPicker.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.toggle('selected', option.dataset.color === tag.color);
        });
    } else {
        // 创建模式
        title.textContent = '创建标签';
        nameInput.value = '';
        descInput.value = '';
        submitBtn.innerHTML = '<i class="ri-save-line"></i>保存标签';

        // 清除颜色选择
        const colorOptions = colorPicker.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
        });
        // 默认选择第一个颜色
        if (colorOptions.length > 0) {
            colorOptions[0].classList.add('selected');
        }
    }

    modal.classList.add('active');
    nameInput.focus();
}

/**
 * 关闭标签模态框
 */
function closeTagModal() {
    const modal = document.getElementById('tagModal');
    if (modal) {
        modal.classList.remove('active');
        editingTagId = null;
    }
}

/**
 * 处理标签表单提交
 */
function handleTagFormSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('tagName');
    const descInput = document.getElementById('tagDescription');
    const selectedColor = document.querySelector('.color-option.selected');

    if (!nameInput || !selectedColor) return;

    const tagData = {
        name: nameInput.value.trim(),
        description: descInput ? descInput.value.trim() : '',
        color: selectedColor.dataset.color
    };

    if (!tagData.name) {
        showNotification('请输入标签名称', 'error');
        nameInput.focus();
        return;
    }

    // 检查标签名称是否重复
    const existingTag = tags.find(tag =>
        tag.name.toLowerCase() === tagData.name.toLowerCase() &&
        tag.id !== editingTagId
    );

    if (existingTag) {
        showNotification('标签名称已存在', 'error');
        nameInput.focus();
        return;
    }

    if (editingTagId) {
        updateTag(editingTagId, tagData);
    } else {
        createTag(tagData);
    }

    closeTagModal();
}

/**
 * 创建标签
 */
async function createTag(tagData) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/api/tags', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tagData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || '创建标签失败');
        }

        const data = await response.json();
        const newTag = data.tag;

        // 添加到本地数组
        tags.unshift(newTag);
        applyFiltersAndSort();

        showNotification('标签创建成功', 'success');
    } catch (error) {
        console.error('创建标签错误:', error);
        showNotification(error.message || '创建标签失败', 'error');
    }
}

/**
 * 更新标签
 */
async function updateTag(tagId, tagData) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch(`/api/tags/${tagId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tagData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || '更新标签失败');
        }

        const data = await response.json();
        const updatedTag = data.tag;

        // 更新本地数组
        const tagIndex = tags.findIndex(tag => tag.id === tagId);
        if (tagIndex !== -1) {
            tags[tagIndex] = updatedTag;
            applyFiltersAndSort();
        }

        showNotification('标签更新成功', 'success');
    } catch (error) {
        console.error('更新标签错误:', error);
        showNotification(error.message || '更新标签失败', 'error');
    }
}

/**
 * 编辑标签
 */
function editTag(tagId) {
    openTagModal(tagId);
}

/**
 * 删除标签
 */
async function deleteTag(tagId) {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    const message = tag.imageCount > 0
        ? `确定要删除标签"${tag.name}"吗？这将移除 ${tag.imageCount} 张图片的标签关联。`
        : `确定要删除标签"${tag.name}"吗？`;

    if (confirm(message)) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch(`/api/tags/${tagId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || '删除标签失败');
            }

            // 从本地数组中移除
            tags = tags.filter(t => t.id !== tagId);
            selectedTags.delete(tagId);
            applyFiltersAndSort();
            updateBatchToolbar();

            showNotification('标签已删除', 'success');
        } catch (error) {
            console.error('删除标签错误:', error);
            showNotification(error.message || '删除标签失败', 'error');
        }
    }
}

/**
 * 批量合并标签
 */
async function handleBatchMerge() {
    if (selectedTags.size < 2) {
        showNotification('请至少选择两个标签进行合并', 'warning');
        return;
    }

    const selectedTagsArray = Array.from(selectedTags);
    const tagNames = selectedTagsArray.map(id =>
        tags.find(tag => tag.id === id)?.name
    ).filter(Boolean).join('、');

    if (confirm(`确定要合并这些标签吗？\n${tagNames}\n\n合并后将保留第一个标签，其他标签将被删除。`)) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const primaryTagId = selectedTagsArray[0];

            const response = await fetch('/api/tags/batch', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    operation: 'merge',
                    tagIds: selectedTagsArray,
                    targetTagId: primaryTagId
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || '合并标签失败');
            }

            const data = await response.json();

            // 重新加载标签列表
            await loadTags();
            clearSelection();

            showNotification(data.message || '标签合并成功', 'success');
        } catch (error) {
            console.error('批量合并标签错误:', error);
            showNotification(error.message || '合并标签失败', 'error');
        }
    }
}

/**
 * 批量删除标签
 */
async function handleBatchDelete() {
    if (selectedTags.size === 0) return;

    const selectedTagsArray = Array.from(selectedTags);
    const totalImages = selectedTagsArray.reduce((total, tagId) => {
        const tag = tags.find(t => t.id === tagId);
        return total + (tag ? tag.imageCount : 0);
    }, 0);

    const message = totalImages > 0
        ? `确定要删除 ${selectedTags.size} 个标签吗？这将移除 ${totalImages} 张图片的标签关联。`
        : `确定要删除 ${selectedTags.size} 个标签吗？`;

    if (confirm(message)) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch('/api/tags/batch', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    operation: 'delete',
                    tagIds: selectedTagsArray
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || '删除标签失败');
            }

            const data = await response.json();

            // 重新加载标签列表
            await loadTags();
            clearSelection();

            showNotification(data.message || '标签删除成功', 'success');
        } catch (error) {
            console.error('批量删除标签错误:', error);
            showNotification(error.message || '删除标签失败', 'error');
        }
    }
}

/**
 * 更新统计信息
 */
function updateStats() {
    const totalTagsElement = document.getElementById('totalTags');
    const totalImagesElement = document.getElementById('totalImages');

    if (totalTagsElement) {
        totalTagsElement.textContent = tags.length;
    }

    if (totalImagesElement) {
        const totalImages = tags.reduce((total, tag) => total + tag.imageCount, 0);
        totalImagesElement.textContent = totalImages;
    }
}

/**
 * 显示通知
 */
function showNotification(message, type = 'info') {
    // 使用common.js中的函数
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        // 降级方案
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    const grid = document.getElementById('tagsGrid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <div class="loading-spinner"></div>
                <p style="margin-top: 1rem; color: var(--text-light);">正在加载标签...</p>
            </div>
        `;
    }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    // 加载完成后会通过renderTags重新渲染内容，无需特殊处理
}

/**
 * 显示错误信息
 */
function showError(message) {
    const grid = document.getElementById('tagsGrid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <i class="ri-error-warning-line" style="font-size: 3rem; color: var(--error-color); margin-bottom: 1rem;"></i>
                <p style="color: var(--error-color); font-weight: 600;">${message}</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">重新加载</button>
            </div>
        `;
    }
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
    // 使用common.js中的函数
    if (window.commonUtils && window.commonUtils.formatDate) {
        return window.commonUtils.formatDate(dateString);
    } else {
        // 降级方案
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else if (diffDays < 30) {
            return `${Math.floor(diffDays / 7)}周前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    // 使用common.js中的函数
    if (window.commonUtils && window.commonUtils.debounce) {
        return window.commonUtils.debounce(func, wait);
    } else {
        // 降级方案
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

/**
 * 导出标签
 */
function handleExportTags() {
    try {
        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            tags: tags.map(tag => ({
                name: tag.name,
                description: tag.description,
                color: tag.color,
                createdAt: tag.createdAt
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `tags-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`成功导出 ${tags.length} 个标签`, 'success');
    } catch (error) {
        console.error('导出标签错误:', error);
        showNotification('导出标签失败', 'error');
    }
}

/**
 * 导入标签
 */
function handleImportTags() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.tags || !Array.isArray(importData.tags)) {
                throw new Error('无效的标签文件格式');
            }

            const importTags = importData.tags;
            let successCount = 0;
            let skipCount = 0;

            for (const tagData of importTags) {
                if (!tagData.name || !tagData.color) {
                    skipCount++;
                    continue;
                }

                // 检查是否已存在同名标签
                const existingTag = tags.find(tag =>
                    tag.name.toLowerCase() === tagData.name.toLowerCase()
                );

                if (existingTag) {
                    skipCount++;
                    continue;
                }

                // 创建新标签
                try {
                    await createTag({
                        name: tagData.name,
                        description: tagData.description || '',
                        color: tagData.color
                    });
                    successCount++;
                } catch (error) {
                    console.error('创建标签失败:', error);
                    skipCount++;
                }
            }

            showNotification(
                `导入完成：成功 ${successCount} 个，跳过 ${skipCount} 个`,
                successCount > 0 ? 'success' : 'warning'
            );

            // 重新加载标签列表
            if (successCount > 0) {
                await loadTags();
            }
        } catch (error) {
            console.error('导入标签错误:', error);
            showNotification('导入标签失败：' + error.message, 'error');
        }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

/**
 * 添加标签卡片动画效果
 */
function addTagCardAnimations() {
    const tagCards = document.querySelectorAll('.tag-card');

    tagCards.forEach((card, index) => {
        // 添加进入动画
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);

        // 添加悬停效果增强
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px) scale(1.02)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
}

/**
 * 增强渲染标签函数
 */
const originalRenderTags = renderTags;
function renderTags() {
    originalRenderTags();

    // 添加动画效果
    setTimeout(() => {
        addTagCardAnimations();
        updateStatsChart();
    }, 100);
}

/**
 * 切换统计图表显示
 */
function toggleStatsChart() {
    const statsChart = document.getElementById('tagsStatsChart');
    const toggleBtn = document.getElementById('statsToggleBtn');
    const icon = toggleBtn.querySelector('i');

    if (statsChart.style.display === 'none') {
        statsChart.style.display = 'block';
        icon.className = 'ri-eye-off-line';
        updateStatsChart();
        localStorage.setItem('showTagsStats', 'true');
    } else {
        statsChart.style.display = 'none';
        icon.className = 'ri-eye-line';
        localStorage.setItem('showTagsStats', 'false');
    }
}

/**
 * 初始化统计图表显示状态
 */
function initStatsChart() {
    const showStats = localStorage.getItem('showTagsStats') !== 'false';
    const statsChart = document.getElementById('tagsStatsChart');
    const toggleBtn = document.getElementById('statsToggleBtn');
    const icon = toggleBtn?.querySelector('i');

    if (showStats && tags.length > 0) {
        statsChart.style.display = 'block';
        if (icon) icon.className = 'ri-eye-off-line';
        updateStatsChart();
    } else {
        statsChart.style.display = 'none';
        if (icon) icon.className = 'ri-eye-line';
    }
}

/**
 * 更新统计图表
 */
function updateStatsChart() {
    const canvas = document.getElementById('tagUsageChart');
    if (!canvas || tags.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();

    // 设置canvas尺寸
    canvas.width = rect.width - 32;
    canvas.height = 180;

    // 获取前10个最常用的标签
    const sortedTags = [...tags]
        .filter(tag => tag.imageCount > 0)
        .sort((a, b) => b.imageCount - a.imageCount)
        .slice(0, 10);

    if (sortedTags.length === 0) {
        // 显示无数据提示
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-light');
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('暂无标签使用数据', canvas.width / 2, canvas.height / 2);
        return;
    }

    // 绘制柱状图
    const barWidth = (canvas.width - 80) / sortedTags.length;
    const maxCount = Math.max(...sortedTags.map(tag => tag.imageCount));
    const barMaxHeight = canvas.height - 60;

    sortedTags.forEach((tag, index) => {
        const x = 40 + index * barWidth;
        const barHeight = (tag.imageCount / maxCount) * barMaxHeight;
        const y = canvas.height - 40 - barHeight;

        // 绘制柱子
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, tag.color);
        gradient.addColorStop(1, tag.color + '80');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 10, barHeight);

        // 绘制数值
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-color');
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(tag.imageCount.toString(), x + (barWidth - 10) / 2, y - 5);

        // 绘制标签名
        ctx.save();
        ctx.translate(x + (barWidth - 10) / 2, canvas.height - 10);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.fillText(tag.name.length > 8 ? tag.name.substring(0, 8) + '...' : tag.name, 0, 0);
        ctx.restore();
    });

    // 绘制Y轴标签
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-light');
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = Math.round((maxCount / 5) * i);
        const y = canvas.height - 40 - (barMaxHeight / 5) * i;
        ctx.fillText(value.toString(), 35, y + 3);
    }
}

/**
 * 增强加载标签函数
 */
const originalLoadTags = loadTags;
async function loadTags() {
    await originalLoadTags();
    initStatsChart();
}