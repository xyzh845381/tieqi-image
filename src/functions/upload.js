import { errorHandling, telemetryData } from "./utils/middleware";
import { authMiddleware } from "./utils/auth";

// 添加认证中间件包装
export const authenticatedUpload = async (c) => {
    // 检查是否有认证头
    const authHeader = c.req.header('Authorization');

    // 如果有认证头，验证用户
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authMiddleware(c, () => upload(c));
    }

    // 如果没有认证头，允许匿名上传
    return upload(c);
};

export async function upload(c) {
    const env = c.env;
    // 获取用户信息（如果已认证）
    const user = c.get('user');
    const userId = user ? user.id : null;

    // 添加调试日志
    console.log('上传请求 - 用户信息:', user ? JSON.stringify(user) : '未登录');
    console.log('上传请求 - 用户ID:', userId);

    try {
        const formData = await c.req.formData();

        // 错误处理和遥测数据
        await errorHandling(c);
        telemetryData(c);

        // 检查是否是批量上传
        const files = formData.getAll('file');
        if (!files || files.length === 0) {
            throw new Error('未上传文件');
        }

        console.log(`接收到${files.length}个文件上传请求`);

        // 处理所有文件上传
        const uploadResults = [];
        for (const uploadFile of files) {
            if (!uploadFile) continue;

            const fileName = uploadFile.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();

            console.log(`处理文件: ${fileName}, 类型: ${uploadFile.type}, 扩展名: ${fileExtension}, 大小: ${uploadFile.size}`);

            // 检测是否为GIF文件
            const isGifFile = fileExtension === 'gif' || uploadFile.type === 'image/gif';
            if (isGifFile) {
                console.log(`检测到GIF文件: ${fileName}, Telegram可能会将其转换为MP4格式`);
            }

            const telegramFormData = new FormData();
            telegramFormData.append("chat_id", env.TG_Chat_ID);

            // 根据文件类型选择合适的上传方式
            let apiEndpoint;
            if (uploadFile.type.startsWith('image/')) {
                // 对于图片类型，使用sendDocument以保持原图质量
                telegramFormData.append("document", uploadFile);
                apiEndpoint = 'sendDocument';
                console.log(`图片文件使用sendDocument上传: ${fileName}`);

                if (isGifFile) {
                    console.log(`注意: GIF文件可能被Telegram自动转换为MP4格式`);
                }
            } else if (uploadFile.type.startsWith('audio/')) {
                telegramFormData.append("audio", uploadFile);
                apiEndpoint = 'sendAudio';
                console.log(`音频文件使用sendAudio上传: ${fileName}`);
            } else if (uploadFile.type.startsWith('video/')) {
                telegramFormData.append("video", uploadFile);
                apiEndpoint = 'sendVideo';
                console.log(`视频文件使用sendVideo上传: ${fileName}`);
            } else {
                telegramFormData.append("document", uploadFile);
                apiEndpoint = 'sendDocument';
                console.log(`其他文件使用sendDocument上传: ${fileName}`);
            }

            const result = await sendToTelegram(telegramFormData, apiEndpoint, env);

            if (!result.success) {
                console.error(`文件 ${fileName} 上传失败:`, result.error);
                continue;
            }

            const fileId = getFileId(result.data);

            if (!fileId) {
                console.error(`文件 ${fileName} 获取文件ID失败，响应数据:`, result.data);
                continue;
            }

            console.log(`文件 ${fileName} 获取到文件ID: ${fileId}`);

            // 将文件信息保存到 KV 存储
            // 对于GIF文件，保持原始扩展名，即使Telegram转换为MP4
            const fileKey = `${fileId}.${fileExtension}`;
            const timestamp = Date.now();

            console.log(`生成文件键: ${fileKey}`);

            // 如果是GIF文件，记录可能的格式转换
            if (isGifFile) {
                console.log(`GIF文件保存为: ${fileKey} (保持原始扩展名)`);
            }

            if (env.img_url) {
                // 创建文件元数据
                const metadata = {
                    TimeStamp: timestamp,
                    ListType: "None",
                    Label: "None",
                    liked: false,
                    fileName: fileName,
                    fileSize: uploadFile.size,
                    userId: userId || "anonymous" // 添加用户ID
                };

                // 保存文件元数据
                await env.img_url.put(fileKey, "", { metadata });

                // 如果是已登录用户，将文件添加到用户的文件列表中
                if (userId) {
                    // 获取用户的文件列表
                    const userFilesKey = `user:${userId}:files`;
                    let userFiles = await env.img_url.get(userFilesKey, { type: "json" }) || [];

                    console.log('用户文件列表获取:', userFilesKey, userFiles.length ? `已有${userFiles.length}个文件` : '列表为空');

                    // 添加新文件
                    const newFile = {
                        id: fileKey,
                        fileName: fileName,
                        fileSize: uploadFile.size,
                        uploadTime: timestamp,
                        url: `/file/${fileKey}`
                    };

                    userFiles.push(newFile);
                    console.log('添加新文件到用户列表:', newFile);

                    // 保存更新后的文件列表
                    await env.img_url.put(userFilesKey, JSON.stringify(userFiles));
                    console.log('用户文件列表已更新, 现有文件数:', userFiles.length);
                } else {
                    console.log('匿名上传，不关联用户');
                }
            }

            // 添加到上传结果
            uploadResults.push({ 'src': `/file/${fileKey}` });
        }

        console.log(`成功上传${uploadResults.length}个文件`);
        return c.json(uploadResults);
    } catch (error) {
        console.error('上传错误:', error);
        return c.json({ error: error.message }, 500);
    }
}

/**
 * 获取上传文件的ID
 * 对于图片，我们现在使用document类型上传以保持原图质量
 */
function getFileId(response) {
    if (!response.ok || !response.result) return null;

    const result = response.result;
    // 保留photo处理逻辑以兼容旧数据，但新上传的图片会走document逻辑
    if (result.photo) {
        return result.photo.reduce((prev, current) =>
            (prev.file_size > current.file_size) ? prev : current
        ).file_id;
    }
    if (result.document) return result.document.file_id;
    if (result.video) return result.video.file_id;
    if (result.audio) return result.audio.file_id;

    return null;
}

async function sendToTelegram(formData, apiEndpoint, env, retryCount = 0) {
    const MAX_RETRIES = 2;
    const apiUrl = `https://api.telegram.org/bot${env.TG_Bot_Token}/${apiEndpoint}`;

    try {
        const response = await fetch(apiUrl, { method: "POST", body: formData });
        const responseData = await response.json();

        if (response.ok) {
            return { success: true, data: responseData };
        }

        // 不再需要从sendPhoto转为sendDocument的重试逻辑，因为我们直接使用sendDocument

        return {
            success: false,
            error: responseData.description || '上传到Telegram失败'
        };
    } catch (error) {
        console.error('网络错误:', error);
        if (retryCount < MAX_RETRIES) {
            // 网络错误时的重试逻辑保留
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return await sendToTelegram(formData, apiEndpoint, env, retryCount + 1);
        }
        return { success: false, error: '发生网络错误' };
    }
}