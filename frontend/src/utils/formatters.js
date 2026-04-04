export const truncateAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount);

export const formatNumber = (n) =>
  new Intl.NumberFormat('en-US').format(n);

export const riskColor = (score) => {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f97316';
  if (score >= 20) return '#eab308';
  return '#22c55e';
};

export const riskLabel = (score) => {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
};
