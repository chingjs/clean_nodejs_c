const { Model, DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const { UUID, UUIDV4, STRING, DOUBLE, BOOLEAN } = DataTypes;

class Fabric extends Model { }

Fabric.init(
  {
    id: {
      type: UUID,
      unique: true,
      defaultValue: UUIDV4,
      allowNull: false,
      primaryKey: true,
      comment: 'Unique identifier for Fabric',
    },
    name: {
      type: STRING,
    },
    desc: {
      type: STRING,
    },
    price: {
      type: DOUBLE,
    },
    photo_url: {
      type: STRING,
    },
    strategy: {
      type: STRING,
    },
    status: {
      type: BOOLEAN,
    },
    updatedBy: {
      type: STRING
    }

  },
  {
    sequelize,
    timestamps: true,
    createdAt: true,
    updatedAt: true,
    tableName: 'fabric',
    modelName: 'fabric',
  }
);

module.exports = Fabric;
