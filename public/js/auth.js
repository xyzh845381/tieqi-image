/**
 * 用户认证相关功能
 */

// 检查用户是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    // 如果没有令牌或用户信息，则未登录
    if (!token || !user) {
        return false;
    }

    // 检查令牌是否过期
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp < now) {
            // 令牌已过期，清除本地存储
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return false;
        }

        return true;
    } catch (error) {
        console.error('令牌解析错误:', error);
        return false;
    }
}

// 获取认证头
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// 初始化认证状态
function initAuth() {
    // 获取当前页面路径
    const path = window.location.pathname;

    // 检查是否已登录
    const isAuthenticated = checkAuth();

    // 获取用户下拉菜单和登录/注册链接
    const userDropdown = document.getElementById('userDropdown');
    const userDisplayName = document.getElementById('userDisplayName');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    if (isAuthenticated) {
        // 用户已登录
        const user = JSON.parse(localStorage.getItem('user'));

        // 更新用户显示名称
        if (userDisplayName) {
            userDisplayName.textContent = user.username;
        }

        // 显示用户下拉菜单
        if (userDropdown) {
            userDropdown.style.display = 'block';
        }

        // 更新桌面端导航链接
        navLinks.forEach(link => {
            if (link.textContent === '登录') {
                link.textContent = '我的图片';
                link.href = '/dashboard.html';
            }
        });

        // 更新移动端导航链接
        mobileNavLinks.forEach(link => {
            if (link.textContent === '登录') {
                link.textContent = '我的图片';
                link.href = '/dashboard.html';
            }
        });

        // 添加移动端退出登录链接（如果不存在）
        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav && !document.getElementById('mobileLogoutBtn')) {
            const logoutLink = document.createElement('a');
            logoutLink.href = '/';
            logoutLink.id = 'mobileLogoutBtn';
            logoutLink.className = 'mobile-nav-link';
            logoutLink.textContent = '退出登录';
            mobileNav.appendChild(logoutLink);
        }

        // 如果当前页面是登录或注册页面，重定向到首页
        if (path === '/login.html' || path === '/register.html') {
            smoothPageTransition('/');
        }

        // 如果当前页面是仪表盘，但令牌无效，重定向到登录页面
        if (path === '/dashboard.html') {
            validateToken().catch(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                smoothPageTransition('/login.html');
            });
        }

        // 如果用户已登录，更新头像显示
        updateUserAvatar();
    } else {
        // 用户未登录

        // 隐藏用户下拉菜单
        if (userDropdown) {
            userDropdown.style.display = 'none';
        }

        // 更新桌面端导航链接
        navLinks.forEach(link => {
            if (link.textContent === '我的图片') {
                link.textContent = '登录';
                link.href = '/login.html';
            }
        });

        // 更新移动端导航链接
        mobileNavLinks.forEach(link => {
            if (link.textContent === '我的图片') {
                link.textContent = '登录';
                link.href = '/login.html';
            }
        });

        // 移除移动端退出登录链接（如果存在）
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
        if (mobileLogoutBtn) {
            mobileLogoutBtn.parentNode.removeChild(mobileLogoutBtn);
        }

        // 如果当前页面是仪表盘，重定向到登录页面
        if (path === '/dashboard.html') {
            smoothPageTransition('/login.html');
        }
    }
}

// 验证令牌
async function validateToken() {
    const token = localStorage.getItem('token');

    if (!token) {
        throw new Error('未找到令牌');
    }

    const response = await fetch('/api/auth/user', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('令牌无效');
    }

    const data = await response.json();
    return data.user;
}

// 登录表单处理
function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const authToggle = document.getElementById('authToggle');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 获取表单数据
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            // 验证输入
            if (!username || !password) {
                showError(loginError, '用户名和密码都是必填项');
                return;
            }

            try {
                // 发送登录请求
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '登录失败');
                }

                // 保存令牌和用户信息
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // 重定向到首页
                smoothPageTransition('/');
            } catch (error) {
                showError(loginError, error.message);
            }
        });
    }
}

// 注册表单处理
function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const authToggle = document.getElementById('authToggle');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 获取表单数据 - 适应新的注册表单字段ID
            const username = document.getElementById('regUsername') ? 
                document.getElementById('regUsername').value : 
                document.getElementById('username').value;
            
            const email = document.getElementById('regEmail') ? 
                document.getElementById('regEmail').value : 
                document.getElementById('email').value;
            
            const password = document.getElementById('regPassword') ? 
                document.getElementById('regPassword').value : 
                document.getElementById('password').value;
            
            // 确认密码可能不存在于新表单中
            const confirmPassword = document.getElementById('confirmPassword') ? 
                document.getElementById('confirmPassword').value : 
                password; // 如果没有确认密码字段，使用密码值

            // 验证输入
            if (!username || !email || !password) {
                showError(loginError, '所有字段都是必填项');
                return;
            }

            if (confirmPassword && password !== confirmPassword) {
                showError(loginError, '两次输入的密码不一致');
                return;
            }

            try {
                // 发送注册请求
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '注册失败');
                }

                // 保存令牌和用户信息
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // 显示成功消息
                alert('注册成功！');

                // 重定向到首页
                smoothPageTransition('/');
            } catch (error) {
                showError(loginError, error.message);
            }
        });
    }
}

// 退出登录
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    // 退出登录函数
    const logout = (e) => {
        e.preventDefault();

        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // 重定向到首页
        smoothPageTransition('/');
    };

    // 桌面端退出按钮
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // 移动端退出按钮
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', logout);
    }
}

// 显示错误信息
function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.classList.add('show');

        // 添加震动效果
        element.classList.add('shake');
        setTimeout(() => {
            element.classList.remove('shake');
        }, 500);

        // 5秒后自动隐藏错误
        setTimeout(() => {
            element.classList.remove('show');
            setTimeout(() => {
                element.style.display = 'none';
            }, 300);
        }, 5000);
    } else {
        // 如果没有找到错误元素，回退到alert
        alert(message);
    }
}

// 更新用户头像显示
function updateUserAvatar() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const userAvatars = document.querySelectorAll('.user-avatar');
    
    if (user && user.avatarUrl) {
        userAvatars.forEach(avatar => {
            // 清空现有内容
            avatar.innerHTML = '';
            
            // 创建头像图片元素
            const img = document.createElement('img');
            img.src = user.avatarUrl;
            img.alt = '用户头像';
            img.className = 'user-avatar-img';
            img.onerror = function() {
                // 如果头像加载失败，显示默认图标
                this.style.display = 'none';
                avatar.innerHTML = '<i class="ri-user-3-line"></i>';
            };
            
            avatar.appendChild(img);
        });
    } else {
        // 显示默认头像图标
        userAvatars.forEach(avatar => {
            avatar.innerHTML = '<i class="ri-user-3-line"></i>';
        });
    }
}

// 上传头像
async function uploadAvatar(file) {
    try {
        // 首先上传文件到图床
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/upload', {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('图片上传失败');
        }
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult || uploadResult.length === 0 || !uploadResult[0].src) {
            throw new Error('上传结果无效');
        }
        
        // 获取上传后的图片链接
        const avatarUrl = window.location.origin + uploadResult[0].src;
        
        // 更新用户头像
        const updateResponse = await fetch('/api/auth/avatar', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ avatarUrl })
        });
        
        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.error || '头像更新失败');
        }
        
        const result = await updateResponse.json();
        
        // 更新本地存储的用户信息
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // 更新页面上的头像显示
        updateUserAvatar();
        
        return result;
    } catch (error) {
        console.error('上传头像错误:', error);
        throw error;
    }
}

// 初始化头像上传功能
function initAvatarUpload() {
    // 检查是否已经初始化过，避免重复初始化
    if (document.getElementById('avatarInput')) {
        return;
    }

    // 创建隐藏的文件输入元素
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.style.display = 'none';
    avatarInput.id = 'avatarInput';
    document.body.appendChild(avatarInput);
    
    // 为所有用户头像添加点击事件
    function handleAvatarClick(e) {
        // 检查用户是否已登录
        if (!checkAuth()) {
            return;
        }

        // 检查点击的元素是否是头像
        const avatarElement = e.target.closest('.user-avatar');
        if (avatarElement) {
            e.preventDefault();
            e.stopPropagation();
            console.log('头像被点击，打开文件选择器');
            avatarInput.click();
        }
    }

    // 使用事件委托绑定点击事件
    document.addEventListener('click', handleAvatarClick);
    
    // 处理文件选择
    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log('文件被选择:', file.name);
        
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        
        // 验证文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片文件大小不能超过5MB');
            return;
        }
        
        try {
            // 显示加载状态
            console.log('开始上传头像...');
            const userAvatars = document.querySelectorAll('.user-avatar');
            userAvatars.forEach(avatar => {
                avatar.innerHTML = '<i class="ri-loader-4-line rotating"></i>';
            });
            
            await uploadAvatar(file);
            
            // 显示成功消息
            console.log('头像上传成功');
            showSuccessMessage('头像更新成功');
            
        } catch (error) {
            console.error('头像上传失败:', error);
            // 恢复头像显示
            updateUserAvatar();
            alert('头像更新失败: ' + error.message);
        }
        
        // 清空文件输入
        avatarInput.value = '';
    });
}

// 显示成功消息
function showSuccessMessage(message) {
    // 创建成功消息元素
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    // 显示动画
    setTimeout(() => {
        successDiv.style.opacity = '1';
        successDiv.style.transform = 'translateX(0)';
    }, 100);
    
    // 3秒后自动隐藏
    setTimeout(() => {
        successDiv.style.opacity = '0';
        successDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(successDiv);
        }, 300);
    }, 3000);
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化认证状态
    initAuth();

    // 初始化登录表单
    initLoginForm();

    // 初始化注册表单
    initRegisterForm();

    // 初始化退出登录
    initLogout();

    // 初始化头像上传功能
    initAvatarUpload();
});
