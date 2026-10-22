const users = [
  { id: 1, name: 'Ana Souza', email: 'ana@example.com', favoriteProductIds: [1, 3] },
  { id: 2, name: 'Bruno Lima', email: 'bruno@example.com', favoriteProductIds: [2] },
  { id: 3, name: 'Carla Dias', email: 'carla@example.com', favoriteProductIds: [] },
];

module.exports = {
  findAll: () => users,
  findById: (id) => users.find((u) => u.id === id) || null,
};
