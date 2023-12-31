/* eslint-disable camelcase */
const { Router } = require('express');
const AWS = require('aws-sdk');

const ServiceTypes = require('../../configs/tables/ServiceTypes');
const MDR = require('../../configs/tables/MDR');


const router = Router();

/**
  1.) Create Service
  2.) Get All Services

*/

// Create Service
// POST @-> /api/service/create
// To create service

router.post('/create', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing Name' })
  }
  ServiceTypes.findOne({ where: { name: name } }).then((foundExist) => {
    if (foundExist) {
      return res
        .status(400)
        .json({ error: 'Service Type have already registered.' });
    } else {
      const newService = ServiceTypes.build({
        name,
        status: true,
      });

      newService
        .save()
        .then((savedRecord) => {
          return res.status(200).json({
            status: 200,
            message: 'Created Successfully',
            savedRecord,
          });
        })
        .catch((err) => {
          console.error('Error to save new record', err);
          console.error(err);
          return res.status(400).json({ error: 'Internal Error' });
        });
    }
  });
});

// GET ALL SERVICES DETAILS
// POST @-> /api/service/getall
// To get all services details
router.get('/getAll', (req, res) => {
  ServiceTypes.findAll()
    .then((serviceData) => {

      return res.status(200).json(serviceData);
    })
    .catch((err) => {
      console.error('Error when finding all service type ');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});


router.post('/createMDR', async (req, res) => {
  const { name, rate, min, fixed, note } = req.body;
  // console.log(req.body)
  if (!name || !rate || !min || !fixed) {
    return res.status(400).json({ error: 'Missing Input' })
  }
  try {
    const checkRecord = await MDR.findOne({ where: { name } })

    if (!checkRecord) {
      const newRecord = MDR.build({
        name, rate, min, fixed, note
      });
      await newRecord.save()
    }
    else {
      checkRecord.min = min
      checkRecord.rate = rate
      checkRecord.fixed = fixed
      checkRecord.note = note
      await checkRecord.save()
    }
    return res.status(200).json({ message: 'Created Successfully' })
  }
  catch (err) {
    console.error('Error when creating MDR');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/getMDR', async (req, res) => {

  try {
    const getMDR = await MDR.findAll({})

    // console.log(getMDR)
    return res.status(200).json({ MDRList: getMDR });
  }
  catch (err) {
    console.error('Error when finding the MDR.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post("/removeMDR", async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json('Missing Details ID')
  }
  try {
    const checkRecord = await MDR.findOne({
      where: { id },
    });
    if (!checkRecord) {
      return res.status(400).json({ error: "MDR not found." });
    }
    const runRecord = await MDR.destroy({ where: { id } })
    if (runRecord === 1) {
      return res
        .status(200)
        .json({
          id,
          message: 'Removed MDR successfully'
        });
    }
  }
  catch (error) {
    console.error(error);
    return res.status(400).json({ error: "Internal Error" });
  }
});

module.exports = router;
