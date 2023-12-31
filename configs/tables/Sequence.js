const { Model, DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const { UUID, UUIDV4, STRING, FLOAT, BOOLEAN } = DataTypes;

class Sequence extends Model { }

Sequence.init(
	{
		id: {
			type: UUID,
			primaryKey: true,
			unique: true,
			defaultValue: UUIDV4,
			allowNull: false,
			comment: "UUID for identifying"
		},
		type: {
			type: STRING,
			allowNull: false,
		},
		currentSequence: {
			type: FLOAT,
			defaultValue: 0,
		},
		status: {
			type: BOOLEAN,
			defaultValue: true,
		}
	},
	{
		sequelize,
		timestamps: true,
		createdAt: true,
		updatedAt: true,
		comment: "sequence",
		tableName: "sequence",
		modelName: "sequence"
	}
);

module.exports = Sequence;