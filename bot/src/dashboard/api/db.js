const { sequelize } = require('../../database');
const Sequelize = require('sequelize');

module.exports = {
    sequelize,
    Sequelize,
    Op: Sequelize.Op
}; 