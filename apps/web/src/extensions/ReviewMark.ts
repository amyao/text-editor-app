import { Mark, mergeAttributes } from '@tiptap/core'

type ReviewStatus = 'in_review' | 'completed'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    reviewMark: {
      setReviewMark: (reviewId: number, status?: ReviewStatus) => ReturnType
      updateReviewMark: (reviewId: number, status: ReviewStatus) => ReturnType
    }
  }
}

export const ReviewMark = Mark.create({
  name: 'reviewMark',

  inclusive: false,

  addAttributes() {
    return {
      reviewId: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute('data-review-id')),
        renderHTML: ({ reviewId }) => ({ 'data-review-id': String(reviewId) }),
      },
      status: {
        default: 'in_review',
        parseHTML: (element) => element.getAttribute('data-review-status') ?? 'in_review',
        renderHTML: ({ status }) => ({ 'data-review-status': status }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-review-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'review-highlight' }),
      0,
    ]
  },

  addCommands() {
    return {
      setReviewMark:
        (reviewId, status = 'in_review') =>
        ({ commands }) =>
          commands.setMark(this.name, { reviewId, status }),
      updateReviewMark:
        (reviewId, status) =>
        ({ state, dispatch }) => {
          const transaction = state.tr
          let changed = false

          state.doc.descendants((node, position) => {
            if (!node.isText) return
            const mark = node.marks.find(
              (candidate) =>
                candidate.type.name === this.name &&
                Number(candidate.attrs.reviewId) === reviewId,
            )
            if (!mark) return

            transaction.removeMark(position, position + node.nodeSize, mark)
            transaction.addMark(
              position,
              position + node.nodeSize,
              mark.type.create({ reviewId, status }),
            )
            changed = true
          })

          if (changed && dispatch) dispatch(transaction)
          return changed
        },
    }
  },
})
