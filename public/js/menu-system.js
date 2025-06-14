/**
 * 菜单管理系统 - TG-Image
 * 处理侧边菜单和导航功能
 */

document.addEventListener('DOMContentLoaded', () => {
    // 初始化菜单系统
    initMenuSystem();
    
    // 初始化菜单项状态
    updateMenuItemsState();
});

/**
 * 初始化菜单系统
 */
function initMenuSystem() {
    // 获取菜单元素
    const sideMenu = document.getElementById('sideMenu');
    const menuToggle = document.getElementById('menuToggle');
    const menuOverlay = document.getElementById('menuOverlay');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const appContainer = document.querySelector('.app-container');
    const uploadMenuBtn = document.getElementById('uploadMenuBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const themeMenuItem = document.getElementById('themeMenuItem');
    const loginMenuItem = document.getElementById('loginMenuItem');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    
    // 检查元素是否存在
    if (!sideMenu || !appContainer) {
        console.error('菜单元素未找到');
        return;
    }
    
    // 从本地存储中获取菜单状态
    const menuState = localStorage.getItem('menuState') || 'expanded';
    
    // 根据保存的状态设置初始菜单状态
    if (menuState === 'collapsed') {
        sideMenu.classList.add('collapsed');
        appContainer.classList.remove('menu-expanded');
        appContainer.classList.add('menu-collapsed');
    }
    
    // 菜单切换按钮点击事件
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            toggleMenu();
        });
    }
    
    // 移动端菜单按钮点击事件
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sideMenu.classList.add('mobile-visible');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // 菜单遮罩点击事件
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            sideMenu.classList.remove('mobile-visible');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // 上传按钮点击事件
    if (uploadMenuBtn) {
        uploadMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToUploadArea();
        });
    }
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            scrollToUploadArea();
        });
    }
    
    // 主题切换菜单项点击事件
    if (themeMenuItem) {
        themeMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            toggleTheme();
        });
    }
    
    // 退出登录菜单项点击事件
    if (logoutMenuItem) {
        logoutMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            // 移动端自动折叠菜单
            if (!sideMenu.classList.contains('mobile-visible')) {
                sideMenu.classList.remove('collapsed');
            }
        }
    });
    
    // 初始检查窗口大小
    if (window.innerWidth <= 768) {
        sideMenu.classList.remove('collapsed');
    }
}

/**
 * 切换菜单展开/折叠状态
 */
function toggleMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const appContainer = document.querySelector('.app-container');
    
    if (sideMenu.classList.contains('collapsed')) {
        // 展开菜单
        sideMenu.classList.remove('collapsed');
        appContainer.classList.remove('menu-collapsed');
        appContainer.classList.add('menu-expanded');
        localStorage.setItem('menuState', 'expanded');
    } else {
        // 折叠菜单
        sideMenu.classList.add('collapsed');
        appContainer.classList.remove('menu-expanded');
        appContainer.classList.add('menu-collapsed');
        localStorage.setItem('menuState', 'collapsed');
    }
}

/**
 * 滚动到上传区域
 */
function scrollToUploadArea() {
    const uploadContainer = document.querySelector('.upload-container');
    if (uploadContainer) {
        uploadContainer.scrollIntoView({ behavior: 'smooth' });
        
        // 在移动端，关闭菜单
        if (window.innerWidth <= 768) {
            const sideMenu = document.getElementById('sideMenu');
            const menuOverlay = document.getElementById('menuOverlay');
            
            sideMenu.classList.remove('mobile-visible');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}

/**
 * 切换主题
 */
function toggleTheme() {
    // 使用全局主题管理器
    if (window.themeManager) {
        window.themeManager.toggleTheme();
    }
}

/**
 * 退出登录
 */
function logout() {
    // 清除本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // 重定向到首页
    window.location.href = '/';
}

/**
 * 更新菜单项状态
 */
function updateMenuItemsState() {
    // 检查用户是否已登录
    const isLoggedIn = checkUserLoggedIn();
    
    // 获取菜单项
    const loginMenuItem = document.getElementById('loginMenuItem');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    const loginBtn = document.getElementById('loginBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (isLoggedIn) {
        // 用户已登录
        if (loginMenuItem) loginMenuItem.style.display = 'none';
        if (logoutMenuItem) logoutMenuItem.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'block';
        
        // 更新用户显示名称
        updateUserDisplayName();
    } else {
        // 用户未登录
        if (loginMenuItem) loginMenuItem.style.display = 'flex';
        if (logoutMenuItem) logoutMenuItem.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'flex';
        if (userDropdown) userDropdown.style.display = 'none';
    }
    
    // 设置当前页面对应的菜单项为活动状态
    setActiveMenuItem();
}

/**
 * 检查用户是否已登录
 */
function checkUserLoggedIn() {
    const token = localStorage.getItem('token');
    return !!token;
}

/**
 * 更新用户显示名称
 */
function updateUserDisplayName() {
    const userDisplayName = document.getElementById('userDisplayName');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (userDisplayName && user.username) {
        userDisplayName.textContent = user.username;
    }
}

/**
 * 设置当前页面对应的菜单项为活动状态
 */
function setActiveMenuItem() {
    const currentPath = window.location.pathname;
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        const itemPath = item.getAttribute('href');
        
        // 移除所有活动状态
        item.classList.remove('active');
        
        // 设置当前页面对应的菜单项为活动状态
        if (itemPath && currentPath === itemPath) {
            item.classList.add('active');
        }
        
        // 首页特殊处理
        if (currentPath === '/' && itemPath === '/') {
            item.classList.add('active');
        }
    });
}
