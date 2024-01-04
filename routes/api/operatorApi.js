const { Router } = require('express');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

const { genNewOperatorNum, deductGenNum } = require('../../configs/function/misc');
const { uploadtos3 } = require('../../configs/function/aws');

const Operator = require('../../configs/tables/Operator');
const Admin = require('../../configs/tables/Admin');

const { Op } = require('sequelize');
const Record = require('../../configs/tables/Record');
const Bucket = process.env.BUCKETNAME;
require('dotenv').config();

const router = Router();

const s3 = new AWS.S3();

/**
  1.) CREATE NEW OPERATOR
  2.) EDIT OPERATOR DETAILS
  3.) GET 1 OPERATOR DETAILS
  4.) GET ALL OPERATOR DETAILS
  5.) OPERATOR LOGIN
  6.) ADD OPERATOR TASK
  7.) GET ALL PAST TASK
  8.) GET ALL PENDING TASK
*/

// CREATE NEW OPERATOR
// POST @-> /api/operator/create
// To create operator
router.post('/create', async (req, res) => {
  const { full_name, phone_number, email, password, confirmPassword, adminName } = req.body;
  const salt = bcrypt.genSaltSync(13);
  const hash = bcrypt.hashSync(password, salt);
  try {
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password must be same!', });
    }
    const foundExist = await Operator.findOne({
      where: { phone_number },
    })
    const foundAdmin = await Admin.findOne({ where: { username: adminName } })
    if (!foundAdmin) {
      return res.status(400).json({ error: 'Admin not found' })
    }
    if (foundExist) {
      return res.status(400).json({ error: 'Existing Email or Phone' });
    } else {
      genNewOperatorNum("OPERATOR", (err, oid) => {
        // user just want to register
        const newOperator = Operator.build({
          oid,
          full_name,
          phone_number,
          email: email ? email : '',
          password: hash,
          verified: true,
          adminId: foundAdmin.id
        });
        newOperator
          .save()
          .then((savedUser) => {
            res.status(200).json({ message: 'Successfully Created!' });
          }).catch((err) => {
            deductGenNum("OPERATOR", (err) => {
              console.log("failed and deducted!", err)
            })
          })
      })
    }
  }
  catch (err) {
    console.error('Error when saving new operator', err);
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
})

// EDIT OPERATOR DETAILS
// POST @-> /api/operator/details/edit
// To edit operator details
router.post('/details/edit', async (req, res) => {
  const {
    phone_number,
    full_name,
    password,
    photoUrl,
    filetype,
    birthday,
    gender,
    email,
    adminName,
  } = req.body;
  const foundAdmin = await Admin.findOne({ where: { username: adminName } })
  if (!foundAdmin) {
    return res.status(400).json({ error: 'Admin not found' })
  }
  const foundOperator = await Operator.findOne({ where: { phone_number } })
  try {
    if (!foundOperator)
      return res.status(400).json({ error: 'Operator not found' });

    if (photoUrl) {
      const regex = /^data:image\/\w+;base64,/;
      const body = Buffer.from(photoUrl.replace(regex, ''), 'base64');
      const Key = `/user/profilePictures/${foundOperator.phone_number}`;
      //uploading img to s3
      uploadtos3(Key, body, 'base64', filetype, async (status) => {
        console.log(status);
        if (status === 'failed') {
          console.error('S3 image upload failed.');
          return res.status(400).json({ error: 'Image Upload Failed' });
        }
        foundOperator.photo_url = Key;
        foundOperator.full_name = full_name;
        foundOperator.birthday = birthday;
        foundOperator.gender = gender;
        foundOperator.email = email;
        foundOperator.updatedBy = foundAdmin.id;
        await foundOperator.save()
        const getParam = {
          Bucket,
          Key,
        };

        s3.getSignedUrl('getObject', getParam, (err, url) => {
          if (err) {
            console.error('Error when getting object from s3 : \n', err);
            return res.status(400).json({ error: 'Internal Error' });
          }

          return res.status(200).json({
            message: 'Your profile details has been updated!',
            user: savedUser,
          });
        });
      });
    } else {
      foundOperator.full_name = full_name;
      foundOperator.email = email;
      foundOperator.updatedBy = foundAdmin.id;
      await foundOperator.save()
      const Key = `/operator/profilePictures/${foundOperator.phone_number}`;
      const getParam = {
        Bucket,
        Key,
      };

      s3.getSignedUrl('getObject', getParam, (err, url) => {
        if (err) {
          console.error('Error when getting object from s3 : \n', err);
          return res.status(400).json({ error: 'Internal Error' });
        }

        return res.status(200).json({
          message: 'Your profile picture has been updated!',
        });
      })

    }
  }
  catch (err) {
    console.error('Error when finding customer in edit customer details');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

// GET OPERATOR DETAILS
// POST @-> /api/operator/view
// To view operator details
router.post('/view', (req, res) => {
  const { email } = req.body;

  Operator.findOne({ where: { email } })
    .then((operator) => {
      if (!operator) return res.status(400).json({ error: 'Not Exist' });
      let data = {
        name: operator.full_name,
        email: operator.email,
        photo_url: operator.photo_url,
        birthday: operator.birthday,
        gender: operator.gender,
        phone: operator.phone_number,
        password: operator.password,
      };
      if (operator.photo_url) {
        const Key = operator.photo_url;
        const getParam = {
          Bucket,
          Key,
        };
        s3.getSignedUrl('getObject', getParam, (err, url) => {
          if (err) {
            console.error('Error when getting object from s3 : \n', err);
            return res.status(400).json({ error: 'Internal Error' });
          }
          data.photo_url = url;
          return res.status(200).json(data);
        });
      } else {
        return res.status(200).json(data);
      }
    })
    .catch((err) => {
      console.error('Error to get operator data');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// LOGIN
// POST @-> /api/operator/login
// Operator login
router.post('/login', (req, res) => {
  const { phone_number, password } = req.body;

  Operator.findOne({ where: { phone_number } })
    .then((foundRecord) => {
      if (!foundRecord) {
        console.error(req.body);
        return res.status(400).json({
          error:
            'This driver is not registered. Please contact to admin to check.',
        });
      } else {
        bcrypt.compare(password, foundRecord.password, (err, result) => {
          if (err) return res.status(400).json({ error: 'Decryption Error' });

          if (!result)
            return res
              .status(400)
              .json({ error: "You've entered the wrong password" });

          jwt.sign(
            { id: foundRecord.id },
            process.env.JWT_SECRET,
            { expiresIn: '6h' },
            (err, token) => {
              if (err) {
                console.error(
                  'Error when signing driver token in operator login'
                );
                console.error(err);
                return res.status(400).json({ error: 'Internal Error' });
              }
              const data = {
                token,
                operator: foundRecord,
              };
              return res.status(200).json({ data });
            }
          );
        });
      }
    })
    .catch((err) => {
      console.error('Error when finding operator in operator login');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// Create task
// POST @-> /api/operator/createTask
// To create operator task
router.post('/createTask', (req, res) => {
  const { status, operatorId, orderId, location, lockerId } = req.body;

  const newTask = Record.build({
    status,
    operatorId,
    orderId,
    location,
    lockerId,
  });

  newTask
    .save()
    .then(() => {
      return res.status(200).json('success created task');
    })
    .catch((err) => {
      console.error('Error to save new task', err);
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET 1 OPERATOR PAST TASK
// POST @-> /api/operator/viewAllTask
// To view all operator task
router.post('/viewPastTask', (req, res) => {
  const { operatorId } = req.body;
  Record.findAll({ where: { operatorId: operatorId, completed: true } })
    .then((record) => {
      if (!record) return res.status(400).json({ error: 'Empty Data' });
      return res.status(200).json({ pastTask: record });
    })
    .catch((err) => {
      console.error('Error to get all past tas');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// GET 1 OPERATOR Current TASK
// POST @-> /api/operator/viewCurrentTask
// To view all operator task
router.post('/viewCurrentTask', (req, res) => {
  const { operatorId } = req.body;
  Record.findAll({ where: { operatorId: operatorId, completed: false } })
    .then((record) => {
      if (!record) return res.status(400).json({ error: 'Empty Data' });

      return res.status(200).json({ task: record });
    })
    .catch((err) => {
      console.error('Error to get all past tas');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// EDIT DRIVER PASSWORD
// POST @-> /api/operator/resetpassword
// To edit customer detailss
router.post('/resetpassword', (req, res) => {
  const { phone_number, password } = req.body;
  Operator.findOne({ where: { phone_number } })
    .then((foundRecord) => {
      bcrypt.genSalt(13, (err, salt) => {
        if (err) return res.status(400).json({ error: 'Encryption Error' });

        bcrypt.hash(password, salt, (err, hash) => {
          if (err) return res.status(400).json({ error: 'Encryption Error' });

          if (!foundRecord)
            return res.status(400).json({ error: 'User not found' });

          foundRecord.password = hash;

          foundRecord
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
      console.error('Error when finding driver in edit driver details');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});
module.exports = router;
