/* eslint-disable camelcase */
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

const {
  genNewCustomerNum
} = require('../../configs/function/misc');
const { uploadtos3 } = require('../../configs/function/aws');
const Customer = require('../../configs/tables/Customer');
const Otp = require('../../configs/tables/Otp');
const Order = require('../../configs/tables/Order');
const Locker = require('../../configs/tables/Locker');
const Enquiry = require('../../configs/tables/Enquiry');
const { Op } = require('sequelize');
const Bucket = process.env.BUCKETNAME;
require('dotenv').config();
const { sendEmail } = require('../../configs/sendEmail');
const {
  registrationMessage,
} = require('../../configs/function/dynamicController');
const { generateOtp, sendSMS } = require('../../configs/function/sms');
const { checkNumber } = require('../../configs/function/validate');

const router = Router();
const moment = require('moment');
const s3 = new AWS.S3();

/**
  1.) SIGN UP
  2.) EDIT CUSTOMER DETAILS
  3.) GET CUSTOMER DETAILS
  4.) VERIFY OTP
  5.) SEND SUPPORT
  6.) RESET PASSWORD
*/

// SIGN UP
// POST @-> /api/customer/signup
// To create user
router.post('/signup', async (req, res) => {
  const { full_name, phone_number, email, password, country } = req.body;
  console.log('register', req.body);
  const salt = bcrypt.genSaltSync(13);
  const hash = bcrypt.hashSync(password, salt);


  // check if this number or email exist in database
  const foundExist = await Customer.findOne({
    where: {
      phone_number: country + phone_number,
    },
  });

  const foundExistEmail = await Customer.findOne({
    where: {
      email: email,
    },
  });

  try {
    if (foundExist) {
      if (foundExist.verified) {
        console.error('existing email or phone');
        return res
          .status(400)
          .json({ error: 'Email address or Phone number used.' });
      } else {
        foundExist.full_name = full_name;
        foundExist.phone_number = country + phone_number;
        foundExist.email = email;
        foundExist.password = hash;

        foundExist.save().then(() => {
          Otp.findOne({ where: { phone_number: country + phone_number } })
            .then((foundOtp) => {
              if (!foundOtp) {
                generateOtp((otp) => {
                  // sendOTP
                  const newOTP = Otp.build({
                    phone_number: country + phone_number,
                    otp,
                  });
                  const message = registrationMessage(otp);
                  const type = 'register';
                  newOTP
                    .save()
                    .then((savedOtp) => {
                      if (savedOtp) {
                        sendSMS(savedOtp.phone_number, message, type, () =>
                          res.status(200).json({
                            status: 200,
                            message: 'registered succes',
                          })
                        );
                      }
                    })
                    .catch((err) => {
                      console.error('Error when saving new otp : \n', err);
                      return res.status(400).json({ error: 'Internal Error' });
                    });
                });
              } else {
                generateOtp((otp) => {
                  foundOtp.otp = otp;
                  const message = registrationMessage(otp);
                  const type = 'register';
                  foundOtp
                    .save()
                    .then((savedOtp) => {
                      sendSMS(savedOtp.phone_number, message, type, () =>
                        res.status(200).json({
                          status: 200,
                          message: 'registered succes',
                        })
                      );
                    })
                    .catch((err) => {
                      console.log('Error when saving otp in resendOtp');
                      console.log(err);
                      return res.status(400).json({ error: 'Internal Error' });
                    });
                });
              }
            })
            .catch((err) => {
              console.error('Error when saving new user', err);
              console.error(err);
              return res.status(400).json({
                error: 'Email address registered, please use another email.',
              });
            });
        });
      }
    } else {
      // user just want to register
      if (foundExistEmail) {
        console.error('Email address has been used, please use another email.');
        return res.status(400).json({
          error: 'Email address has been used, please use another email.',
        });
      }

      checkNumber(country, phone_number, (err) => {
        if (err) {
          return res.status(400).json({ error: err });
        }

        genNewCustomerNum('CUSTOMER', async (err, newid) => {
          if (err) return res.status(400).json({ error: 'Internal Error' });

          const newUser = Customer.build({
            cid: newid,
            full_name,
            phone_number: country + phone_number,
            email,
            password: hash,
            verified: false,
          });
          await newUser.save();
          //sendOTP
          generateOtp((otp) => {
            const newOTP = Otp.build({
              phone_number: country + phone_number,
              otp,
            });

            const message = registrationMessage(otp);
            const type = 'register';
            newOTP
              .save()
              .then((savedOTP) => {
                if (savedOTP) {
                  sendSMS(savedOTP.phone_number, message, type, () =>
                    res
                      .status(200)
                      .json({ status: 200, message: 'registered succes' })
                  );
                }
              })
              .catch((err) => {
                console.error('Error when saving new otp : \n', err);
                return res.status(400).json({ error: 'Internal Error' });
              });
          });
        });
      });
    }
  } catch (err) {
    console.error('Error when saving new user', err);
    console.error(err);
    return res.status(400).json({
      error: 'Email address registered, please use another email.',
    });
  }

  console.log('Found', foundExist);
});

// EDIT CUSTOMER DETAILS
// POST @-> /api/customer/details/edit
// To edit customer details
router.post('/details/edit', (req, res) => {
  const {
    phone_number,
    full_name,
    password,
    photoUrl,
    address,
    filetype,
    birthday,
    gender,
    email,
  } = req.body;

  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password Must More than 6 length!' });
  }
  Customer.findOne({ where: { phone_number } })
    .then((foundCustomer) => {
      bcrypt.genSalt(13, (err, salt) => {
        if (err) return res.status(400).json({ error: 'Encryption Error' });

        bcrypt.hash(password, salt, (err, hash) => {
          if (err) return res.status(400).json({ error: 'Encryption Error' });

          if (!foundCustomer)
            return res.status(400).json({ error: 'User not found' });

          if (photoUrl) {
            const regex = /^data:image\/\w+;base64,/;
            const body = Buffer.from(photoUrl.replace(regex, ''), 'base64');
            const Key = `/user/profilePictures/${foundCustomer.phone_number}`;
            //uploading img to s3
            uploadtos3(Key, body, 'base64', filetype, (status) => {
              if (status === 'failed') {
                console.error('S3 image upload failed.');
                return res.status(400).json({ error: 'Image Upload Failed' });
              }
              if (password) {
                foundCustomer.password = hash;
              }
              foundCustomer.photo_url = Key;
              foundCustomer.full_name = full_name;
              foundCustomer.address = address;
              foundCustomer.birthday = birthday;
              foundCustomer.gender = gender;
              foundCustomer.email = email;
              foundCustomer.save().then((savedUser) => {
                const getParam = {
                  Bucket,
                  Key,
                };

                s3.getSignedUrl('getObject', getParam, (err, url) => {
                  if (err) {
                    console.error(
                      'Error when getting object from s3 : \n',
                      err
                    );
                    return res.status(400).json({ error: 'Internal Error' });
                  }
                  savedUser.photo_url = url;
                  console.log('error', err);
                  console.log('url', url);

                  return res.status(200).json({
                    data: savedUser,
                    message: 'Successfully Updated!',
                  });
                });
              });
            });
          } else {
            if (password) {
              foundCustomer.password = hash;
            }
            foundCustomer.full_name = full_name;
            foundCustomer.address = address;
            foundCustomer.birthday = birthday;
            foundCustomer.gender = gender;
            foundCustomer.email = email;
            foundCustomer
              .save()
              .then((savedUser) => {
                return res
                  .status(200)
                  .json({ data: savedUser, message: 'Successfully Updated!' });
              })
              .catch((err) => {
                console.error(
                  'Error when saving profile picture key : \n',
                  err
                );
                return res.status(400).json({ error: 'Internal Error' });
              });
          }
        });
      });
    })
    .catch((err) => {
      console.error('Error when finding customer in edit customer details');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET CUSTOMER DETAILS
// POST @-> /api/customer/view
// To view customer details
router.post('/view', async (req, res) => {
  const { phone_number } = req.body;
  console.log('view');
  try {
    const locationList = await Locker.findAll({ where: { status: true } });
    const customer = await Customer.findOne({
      where: { phone_number: phone_number },
    });

    if (!customer) return res.status(400).json({ error: 'Not Exist' });

    let data = {
      cusid: customer.cid,
      full_name: customer.full_name,
      email: customer.email,
      photo_url: customer.photo_url,
      birthday: customer.birthday,
      gender: customer.gender,
      phone_number: customer.phone_number,
      password: customer.password,
      address: customer.address,
      verified: customer.verified ? true : false,
    };
    if (customer.photo_url) {
      const Key = customer.photo_url;
      const getParam = {
        Bucket,
        Key,
      };

      const image = await Promise.resolve(
        s3.getSignedUrlPromise('getObject', getParam)
      );
      data.photo_url = image;
      return res.status(200).json({ data, locationList });
    } else {
      return res.status(200).json({ data, locationList });
    }
  } catch (err) {
    console.error('Error to get customer data');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// VERIFY OTP
// POST @-> /api/customer/verifyotp
// To verify OTP
router.post('/verifyOtp', (req, res) => {
  const { phone, otp } = req.body;
  console.log(req.body);
  Otp.findOne({ where: { phone_number: phone } }).then((foundOtp) => {
    if (!foundOtp || foundOtp.otp !== otp) {
      return res
        .status(400)
        .json({ error: 'OTP does not match, please try again.' });
    } else {
      Customer.findOne({ where: { phone_number: phone } }).then(
        (foundRecord) => {
          // if found customer with the number, then verified = true
          if (!foundRecord)
            return res.status(400).json({ error: 'Customer not found' });
          foundRecord.verified = true;

          foundRecord
            .save()
            .then((savedRecord) => {
              jwt.sign(
                { id: foundRecord.id },
                process.env.JWT_SECRET,
                { expiresIn: '3h' },
                (err, token) => {
                  if (err) {
                    console.error(
                      'Error when signing a jwt token in getUserInfo : \n',
                      err
                    );
                    callback('Internal Error', null);
                  }
                  const returnThis = {
                    token,
                    user: savedRecord,
                    isAuthenticated: true,
                  };
                  return res.status(200).json(returnThis);
                }
              );
            })
            .catch((error) => {
              res.status(400).json({ error: 'Server Error' });
            });
        }
      );
    }
  });
});

// Create Support
// POST @-> /api/customer/support
// To create service

router.post('/sendSupport', async (req, res) => {
  const { orderId, message, phone_number } = req.body;
  try {
    const checkUser = await Customer.findOne({ where: { phone_number } });

    if (!checkUser) {
      return res.status(400).json({ error: 'User not found' });
    }

    const newSupport = Enquiry.build({
      full_name: checkUser.full_name,
      email: checkUser.email,
      orderId,
      message,
      phone_number,
    });

    const checkSaved = await newSupport.save();
    if (checkSaved) {
      sendEmail(
        ['james@test.com.my', 'pam@test.com.my', 'shan@test.com.my'],
        {
          name: checkUser.full_name,
          csEmail: 'support@test.com.my',
          message: message,
        },
        'support',
        `[test] New Enquiry from #${
          orderId ? orderId : checkUser.full_name
        }`
      );
    }
    return res.status(200).json({
      message: 'Created Support Successfully',
    });
  } catch (err) {
    console.error('Error to save new record', err);
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// EDIT CUSTOMER DETAILS
// POST @-> /api/customer/details/edit
// To edit customer detailss
router.post('/resetpassword', (req, res) => {
  const { phone_number, password } = req.body;
  Customer.findOne({ where: { phone_number } })
    .then((foundCustomer) => {
      bcrypt.genSalt(13, (err, salt) => {
        if (err) return res.status(400).json({ error: 'Encryption Error' });

        bcrypt.hash(password, salt, (err, hash) => {
          if (err) return res.status(400).json({ error: 'Encryption Error' });

          if (!foundCustomer)
            return res.status(400).json({ error: 'User not found' });

          foundCustomer.password = hash;

          foundCustomer
            .save()
            .then(() => {
              return res.status(200).json({ password: 'success' });
            })
            .catch((err) => {
              console.error('Error when saving password \n', err);
              return res.status(400).json({ error: 'Internal Error' });
            });
        });
      });
    })
    .catch((err) => {
      console.error('Error when finding customer in edit customer details');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

router.post('/sendMonthly', async (req, res) => {
  const date = new Date();

  const month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  try {
    const orders = await Order.findAll({
      where: {
        payment: true,
        createdAt: {
          [Op.between]: [
            moment(
              new Date(`${date.getFullYear()}-${month[date.getMonth() - 1]}-1`)
            )
              .startOf('month')
              .format(),
            moment(
              new Date(`${date.getFullYear()}-${month[date.getMonth() - 1]}-1`)
            )
              .endOf('month')
              .format(),
          ],
        },
      },
    });

    let hqOrder = orders.filter((o) => o.location === 'HQ');
    let hqAmount = hqOrder
      .map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);
    let LYOrder = orders.filter((l) => l.location === 'Le Yuan');
    let LYAmount = LYOrder.map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);
    let CameliaOrder = orders.filter((c) => c.location === 'Camellia');
    let CameliaAmount = CameliaOrder.map((h) => h.price)
      .reduce((a, b) => a + b, 0)
      .toFixed(2);

    let hqCharges = hqAmount * 0.08 > 50 ? (hqAmount * 0.08).toFixed(2) : 50;
    let LYCharges = LYAmount * 0.08 > 50 ? (LYAmount * 0.08).toFixed(2) : 50;
    let CameliaCharges =
      CameliaAmount * 0.08 > 50 ? (CameliaAmount * 0.08).toFixed(2) : 50;
    console.log('hq orders', hqOrder.length);
    console.log('ly orders', LYOrder.length);
    console.log('cam orders', CameliaOrder.length);

    let html = `
    <style>
    table, th, td {
  border:1px solid black;
  text-align:center;
     }

    </style>
     <div> 
     <table style="width:85%">
  <tr>
  <td>Locker</td>
  <td>Total Orders</td>
  <td>Total Amount</td>
  <td>Charges</td>
  </tr>
  <tr>
    <td>Desa Pandan (HQ)</td>
    <td>${hqOrder.length}</td>
    <td>RM ${hqAmount}</td>
    <td>RM ${hqCharges}</td>
   </tr>
  <tr>
  <td>Residence</td>
  <td>${LYOrder.length}</td>
  <td>RM ${LYAmount}</td>
  <td>RM ${LYCharges}</td>
</tr>
  <tr>
  <td>Serviced Suites</td>
  <td>${CameliaOrder.length}</td>
  <td>RM ${CameliaAmount}</td>
  <td>RM ${CameliaCharges}</td>
 </tr>
</table>
<br/>
    <p>Total charges for this month are RM ${(
      parseFloat(hqCharges) +
      parseFloat(LYCharges) +
      parseFloat(CameliaCharges)
    ).toFixed(2)}. </p> </div>`;

    let message = `Total amount for this month is RM ${hqOrder.length}`;
    if (process.env.email === 'yes') {
      sendEmail(
        ['js.tew@antlysis.com'],
        {
          name: 'Antlysis',
          // csEmail: 'support@test.com.my',
          csEmail: 'js.tew@antlysis.com',
          message: message,
          html: html,
        },
        'support',
        `[test] ${month[date.getMonth()]}'s Sales Report`
      );
      return res.status(200).json({
        message: 'Created Successfully',
      });
    }
  } catch (err) {
    console.error('Error to save new record', err);
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

module.exports = router;
