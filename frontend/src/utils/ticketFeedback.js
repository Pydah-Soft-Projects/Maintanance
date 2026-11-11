export const getFeedbackSatisfaction = (feedback) => {
    if (!feedback || typeof feedback !== 'object') return null;
    if (typeof feedback.satisfied === 'boolean') return feedback.satisfied;
    if (typeof feedback.is_satisfied === 'boolean') return feedback.is_satisfied;

    // Display legacy ratings of 4-5 as satisfied and 1-3 as not satisfied.
    const rating = Number(feedback.rating);
    return Number.isFinite(rating) ? rating >= 4 : null;
};
