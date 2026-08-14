UPDATE conversations c
SET c.title = COALESCE(
  NULLIF(
    LEFT(
      TRIM((
        SELECT CASE
          WHEN m.content LIKE '[image:%' THEN COALESCE(NULLIF(SUBSTRING_INDEX(m.content, '\n', -1), ''), '图片分析')
          ELSE m.content
        END
        FROM messages m
        WHERE m.conversation_id = c.id AND m.role = 'user'
        ORDER BY m.created_at ASC
        LIMIT 1
      )),
      30
    ),
    ''
  ),
  '新对话'
)
WHERE c.title_manually_edited = 0
  AND TRIM(c.title) IN ('标题生成器', '会话标题', '对话标题', '用户问题', '未命名对话');
