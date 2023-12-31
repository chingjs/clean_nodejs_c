const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, BOOLEAN } = DataTypes;

class ServiceTypes extends Model { }

ServiceTypes.init(
  {
    id: {
      type: UUID,
      primaryKey: true,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      comment: 'Unique identifier for ServiceTypes',
    },
    name: {
      type: STRING,
      allowNull: false,
    },
    status: {
			type: BOOLEAN,
			defaultValue: true,
		}
  },
  {
    sequelize, // <- must have sequelize option if using class to declare table
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'service_types',
    modelName: 'service_types',
  }
);

module.exports = ServiceTypes;
