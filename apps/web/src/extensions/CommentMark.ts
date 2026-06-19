import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      setCommentMark: (commentId: number) => ReturnType
      removeCommentMark: (commentId: number) => ReturnType
    }
  }
}

export const CommentMark = Mark.create({
  name: 'commentMark',

  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute('data-comment-id')),
        renderHTML: ({ commentId }) => ({
          'data-comment-id': String(commentId),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'comment-highlight' }),
      0,
    ]
  },

  addCommands() {
    return {
      setCommentMark:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      removeCommentMark:
        (commentId) =>
        ({ state, dispatch }) => {
          const transaction = state.tr
          let changed = false

          state.doc.descendants((node, position) => {
            if (!node.isText) return
            const mark = node.marks.find(
              (candidate) =>
                candidate.type.name === this.name &&
                Number(candidate.attrs.commentId) === commentId,
            )
            if (!mark) return

            transaction.removeMark(position, position + node.nodeSize, mark)
            changed = true
          })

          if (changed && dispatch) dispatch(transaction)
          return changed
        },
    }
  },
})
