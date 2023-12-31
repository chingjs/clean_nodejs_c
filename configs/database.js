const sequelize = require('./sequelize');

const Roles = require('./tables/Roles');
const Order = require('./tables/Order');
const Admin = require('./tables/Admin');
const Inbox = require('./tables/Inbox');
const Fabric = require('./tables/Fabric');
const Locker = require('./tables/Locker');
const Record = require('./tables/Record');
const Refund = require('./tables/Refund');
const Enquiry = require('./tables/Enquiry');
const Payment = require('./tables/Payment');
const Charges = require('./tables/Charges');
const Customer = require('./tables/Customer');
const Discount = require('./tables/Discount');
const Operator = require('./tables/Operator');
const RedeemCode = require('./tables/RedeemCode');
const Reschedule = require('./tables/Reschedule');
const ServiceTypes = require('./tables/ServiceTypes');
const OrderDetails = require('./tables/OrderDetails');
const LockerDetails = require('./tables/LockerDetails');

sequelize
  .authenticate()
  .then(() => console.log('Connected to database successful'))
  .catch((err) => {
    console.error('Connection to database failed');
    console.error(err);
  });

Customer.hasMany(Order);
Customer.hasMany(Enquiry);

Order.hasMany(Payment);
Payment.belongsTo(Order);

Order.hasMany(OrderDetails);
Order.hasMany(Charges);
Order.hasMany(Reschedule);

Reschedule.belongsTo(Order);
OrderDetails.belongsTo(Order);
Charges.belongsTo(Order);

Admin.hasMany(Locker);
Admin.hasMany(Roles);
Admin.hasMany(Charges);
Admin.hasMany(Record);
Admin.hasMany(Reschedule);
Admin.hasMany(Operator)
Operator.belongsTo(Admin)
Record.belongsTo(Admin);
Reschedule.belongsTo(Admin);
Charges.belongsTo(Admin);
Roles.belongsTo(Admin);
Operator.hasMany(Order);
Inbox.hasMany(Record);

Record.hasMany(Reschedule)
Reschedule.belongsTo(Record);

Fabric.hasMany(OrderDetails);
ServiceTypes.hasMany(Fabric);
Fabric.belongsTo(ServiceTypes);
ServiceTypes.hasMany(Order);
Order.belongsTo(ServiceTypes);

Charges.hasMany(Refund);
Refund.belongsTo(Charges);

Customer.hasMany(Discount);
Discount.belongsTo(Customer);

Order.hasMany(Discount);
Discount.belongsTo(Order);

Locker.hasMany(LockerDetails);
LockerDetails.belongsTo(Locker);

RedeemCode.hasMany(Discount);
Discount.belongsTo(RedeemCode);

RedeemCode.hasMany(Order);
Order.belongsTo(RedeemCode);


// sequelize
//   .sync({ alter: true })
//   .then(() => {
//     console.log('Database synced');
//     // console.log(data);
//   })
//   .catch((err) => {
//     console.error('Error when syncing database');
//     console.error(err);
//   });

module.exports = sequelize;
