/**
 * 用户收藏功能相关API
 */
import { errorHandling, telemetryData } from '../utils/middleware';

// 获取用户收藏列表
export async function getUserFavorites(c) {
  try {
    // 错误处理和遥测数据
    await errorHandling(c);
    telemetryData(c);

    const user = c.get('user');
    const userId = user.id;

    console.log('获取用户收藏 - 用户ID:', userId);

    // 获取分页参数
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 获取用户收藏列表
    const userFavoritesKey = `user:${userId}:favorites`;
    let favoriteIds = await c.env.img_url.get(userFavoritesKey, { type: "json" }) || [];

    console.log('用户收藏ID列表:', favoriteIds);

    // 获取收藏图片的详细信息
    const favoriteImages = [];
    for (const favoriteId of favoriteIds) {
      try {
        // 获取图片元数据
        const fileData = await c.env.img_url.getWithMetadata(favoriteId);
        if (fileData && fileData.metadata) {
          // 检查图片是否属于当前用户或者是公开的
          if (fileData.metadata.userId === userId || fileData.metadata.userId === "anonymous") {
            favoriteImages.push({
              id: favoriteId,
              fileName: fileData.metadata.fileName || favoriteId,
              fileSize: fileData.metadata.fileSize || 0,
              uploadTime: fileData.metadata.TimeStamp || Date.now(),
              favoriteTime: fileData.metadata.favoriteTime || Date.now(),
              tags: fileData.metadata.tags || [],
              url: `/file/${favoriteId}`,
              thumbnailUrl: `/file/${favoriteId}`,
              views: fileData.metadata.views || 0
            });
          }
        }
      } catch (error) {
        console.error(`获取收藏图片 ${favoriteId} 信息失败:`, error);
        // 如果某个图片获取失败，从收藏列表中移除
        favoriteIds = favoriteIds.filter(id => id !== favoriteId);
      }
    }

    // 如果收藏列表有变化，更新存储
    if (favoriteIds.length !== favoriteImages.length) {
      await c.env.img_url.put(userFavoritesKey, JSON.stringify(favoriteIds));
    }

    // 按收藏时间排序（最新的在前）
    favoriteImages.sort((a, b) => b.favoriteTime - a.favoriteTime);

    // 分页处理
    const totalItems = favoriteImages.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedImages = favoriteImages.slice(offset, offset + limit);

    console.log(`返回收藏图片: ${paginatedImages.length}/${totalItems}`);

    return c.json({
      images: paginatedImages,
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('获取用户收藏错误:', error);
    return c.json({ error: '获取收藏列表失败' }, 500);
  }
}

// 添加图片到收藏
export async function addToFavorites(c) {
  try {
    // 错误处理和遥测数据
    await errorHandling(c);
    telemetryData(c);

    const user = c.get('user');
    const userId = user.id;
    const fileId = c.req.param('id');

    if (!fileId) {
      return c.json({ error: '文件ID不能为空' }, 400);
    }

    console.log('添加收藏 - 用户ID:', userId, '文件ID:', fileId);

    // 检查文件是否存在
    const fileData = await c.env.img_url.getWithMetadata(fileId);
    if (!fileData || !fileData.metadata) {
      return c.json({ error: '文件不存在' }, 404);
    }

    // 检查文件权限（只能收藏自己的图片或公开图片）
    if (fileData.metadata.userId !== userId && fileData.metadata.userId !== "anonymous") {
      return c.json({ error: '无权收藏此文件' }, 403);
    }

    // 获取用户收藏列表
    const userFavoritesKey = `user:${userId}:favorites`;
    let favoriteIds = await c.env.img_url.get(userFavoritesKey, { type: "json" }) || [];

    // 检查是否已经收藏
    if (favoriteIds.includes(fileId)) {
      return c.json({ error: '图片已在收藏列表中' }, 409);
    }

    // 添加到收藏列表
    favoriteIds.push(fileId);
    await c.env.img_url.put(userFavoritesKey, JSON.stringify(favoriteIds));

    // 更新文件元数据，标记为已收藏并记录收藏时间
    const updatedMetadata = {
      ...fileData.metadata,
      liked: true,
      favoriteTime: Date.now(),
      favoriteUserId: userId // 记录是谁收藏的
    };

    await c.env.img_url.put(fileId, "", { metadata: updatedMetadata });

    console.log('收藏添加成功:', fileId);

    return c.json({ 
      message: '添加收藏成功',
      fileId: fileId,
      favoriteTime: updatedMetadata.favoriteTime
    });
  } catch (error) {
    console.error('添加收藏错误:', error);
    return c.json({ error: '添加收藏失败' }, 500);
  }
}

// 从收藏中移除图片
export async function removeFromFavorites(c) {
  try {
    // 错误处理和遥测数据
    await errorHandling(c);
    telemetryData(c);

    const user = c.get('user');
    const userId = user.id;
    const fileId = c.req.param('id');

    if (!fileId) {
      return c.json({ error: '文件ID不能为空' }, 400);
    }

    console.log('取消收藏 - 用户ID:', userId, '文件ID:', fileId);

    // 获取用户收藏列表
    const userFavoritesKey = `user:${userId}:favorites`;
    let favoriteIds = await c.env.img_url.get(userFavoritesKey, { type: "json" }) || [];

    // 检查是否在收藏列表中
    if (!favoriteIds.includes(fileId)) {
      return c.json({ error: '图片不在收藏列表中' }, 404);
    }

    // 从收藏列表中移除
    favoriteIds = favoriteIds.filter(id => id !== fileId);
    await c.env.img_url.put(userFavoritesKey, JSON.stringify(favoriteIds));

    // 更新文件元数据，取消收藏标记
    const fileData = await c.env.img_url.getWithMetadata(fileId);
    if (fileData && fileData.metadata) {
      const updatedMetadata = {
        ...fileData.metadata,
        liked: false,
        favoriteTime: null,
        favoriteUserId: null
      };

      await c.env.img_url.put(fileId, "", { metadata: updatedMetadata });
    }

    console.log('收藏移除成功:', fileId);

    return c.json({ 
      message: '取消收藏成功',
      fileId: fileId
    });
  } catch (error) {
    console.error('取消收藏错误:', error);
    return c.json({ error: '取消收藏失败' }, 500);
  }
}

// 检查图片是否已收藏
export async function checkFavoriteStatus(c) {
  try {
    const user = c.get('user');
    const userId = user.id;
    const fileId = c.req.param('id');

    if (!fileId) {
      return c.json({ error: '文件ID不能为空' }, 400);
    }

    // 获取用户收藏列表
    const userFavoritesKey = `user:${userId}:favorites`;
    const favoriteIds = await c.env.img_url.get(userFavoritesKey, { type: "json" }) || [];

    const isFavorited = favoriteIds.includes(fileId);

    return c.json({ 
      fileId: fileId,
      isFavorited: isFavorited
    });
  } catch (error) {
    console.error('检查收藏状态错误:', error);
    return c.json({ error: '检查收藏状态失败' }, 500);
  }
}

// 批量操作收藏
export async function batchFavoriteOperation(c) {
  try {
    // 错误处理和遥测数据
    await errorHandling(c);
    telemetryData(c);

    const user = c.get('user');
    const userId = user.id;
    const { fileIds, operation } = await c.req.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return c.json({ error: '文件ID列表不能为空' }, 400);
    }

    if (!['add', 'remove'].includes(operation)) {
      return c.json({ error: '操作类型无效' }, 400);
    }

    console.log(`批量${operation === 'add' ? '添加' : '移除'}收藏 - 用户ID:`, userId, '文件数量:', fileIds.length);

    const results = [];
    
    for (const fileId of fileIds) {
      try {
        if (operation === 'add') {
          // 模拟调用添加收藏的逻辑
          const mockRequest = { req: { param: () => fileId }, get: () => user, env: c.env };
          await addToFavorites(mockRequest);
          results.push({ fileId, success: true, message: '添加成功' });
        } else {
          // 模拟调用移除收藏的逻辑
          const mockRequest = { req: { param: () => fileId }, get: () => user, env: c.env };
          await removeFromFavorites(mockRequest);
          results.push({ fileId, success: true, message: '移除成功' });
        }
      } catch (error) {
        results.push({ fileId, success: false, message: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return c.json({
      message: `批量操作完成: ${successCount}个成功, ${failCount}个失败`,
      results: results,
      summary: {
        total: fileIds.length,
        success: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('批量收藏操作错误:', error);
    return c.json({ error: '批量操作失败' }, 500);
  }
}
