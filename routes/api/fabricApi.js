/* eslint-disable camelcase */
const { Router } = require('express');
const AWS = require('aws-sdk');
const { uploadtos3 } = require('../../configs/function/aws');
const Fabric = require('../../configs/tables/Fabric');
const ServiceTypes = require('../../configs/tables/ServiceTypes')
const Bucket = process.env.BUCKETNAME;
const router = Router();
const s3 = new AWS.S3();
const { Op } = require('sequelize');
/**
  1.) Create Fabric
  2.) Get All Fabric

*/

// Create Fabric
// POST @-> /api/fabric/create
// To create fabric

router.post("/create", (req, res) => {
  const {
    name,
    price,
    photoUrl,
    serviceTypeId,
    filetype,
    strategy,
  } = req.body;
  if (!name || !price || !serviceTypeId || !strategy) { return res.status(400).json({ error: 'Missing details' }) }

  Fabric.findOne({ where: { name, strategy } })
    .then(foundExist => {
      if (foundExist) {
        return res.status(400).json({ error: "Item already registered." });
      }
      else {
        if (photoUrl) {
          const regex = /^data:image\/\w+;base64,/;
          const body = Buffer.from(photoUrl.replace(regex, ''), 'base64');
          const Key = `${serviceTypeId}/itemtype/${strategy}/${name}`;

          uploadtos3(Key, body, 'base64', filetype, (status) => {
            if (status === 'failed') {
              console.error('S3 image upload failed.');
              return res.status(400).json({ error: 'Image Upload Failed' });
            }
            const newFabric = Fabric.build({
              name,
              price,
              photo_url: Key,
              serviceTypeId,
              status: true,
              strategy,
            });
            newFabric.save().then((savedFabric) => {
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
                savedFabric.photo_url = url;
                return res
                  .status(200)
                  .json({
                    data: savedFabric,
                    message: 'Created successfully!',
                  });
              });
            });
          });
        }
        else {
          const newFabric = Fabric.build({
            name,
            price,
            serviceTypeId,
            status: true,
            strategy,
          });
          newFabric.save().then((savedFabric) => {
            return res.status(200).json({
              data: savedFabric, message: 'Created successfully!',
            });
          });
        }
      }
    }).catch(err => {
      console.error("Error to save new record", err);
      console.error(err);
      return res.status(400).json({ error: "Internal Error" });
    });
});

// GET ALL FABRIC DETAILS
// POST @-> /api/fabric/getall
// To get all fabric details
router.post("/getAll", (req, res) => {
  const {
    strategy,
  } = req.body;
  let query = {
    where: {},
    include: ServiceTypes, order: [['name', 'ASC']],
  }

  console.log(req.body)
  if (strategy && strategy.length) {
    query.where.strategy = { [Op.in]: strategy }
  }

  Fabric.findAll(query)
    .then(fabricData => {
      (async () => {
        let returnData = [];
        for (let i = 0; i < fabricData.length; i++) {
          const itemtype = fabricData[i];
          let obj = {
            ...itemtype.dataValues,
            images: []
          };
          if (itemtype.photo_url) {
            const Key = itemtype.photo_url;
            const getParam = {
              Bucket,
              Key
            }
            const url = await Promise.resolve(s3.getSignedUrlPromise("getObject", getParam));
            obj.images.push(url)
            returnData.push(obj);
          } else {
            returnData.push(obj);
          }
        }
        return returnData
      })().then((newData) => {
        const returnThis = {
          garment: newData.filter((item) => item.service_type.name === "Garment"),
          household: newData.filter((item) => item.service_type.name === "Household"),
          shoe: newData.filter((item) => item.service_type.name === "Shoe"),
          laundry: newData.filter((item) => item.service_type.name === "Laundry"),
        }

        return res.status(200).json({ fabricData: newData, allFabricList: returnThis });
      })
    })
    .catch(err => {
      console.error("Error when finding all fabric type ");
      console.error(err);
      return res.status(400).json({ error: "Internal Error" });
    });
});

// GET AVAILABLE FABRIC DETAILS
// POST @-> /api/fabric/getFabricPrice
// To get available fabric details
router.post("/getFabricPrice", async (req, res) => {
  const { strategy } = req.body;
  console.log('req', req.body)
  try {
    const getFabricData = await Fabric.findAll({ where: { status: true, strategy }, include: ServiceTypes, order: [['name', 'ASC']] })
    let returnData = [];
    for (let i = 0; i < getFabricData.length; i++) {
      const itemtype = getFabricData[i];
      let obj = {
        ...itemtype.dataValues,
        images: []
      };
      if (itemtype.photo_url) {
        const Key = itemtype.photo_url;
        const getParam = {
          Bucket,
          Key
        }
        const url = await Promise.resolve(s3.getSignedUrlPromise("getObject", getParam));
        obj.images.push(url)
        returnData.push(obj);
      } else {
        returnData.push(obj);
      }
    }

    const returnThis = {
      garment: returnData.filter((item) => item.service_type.name === "Garment"),
      household: returnData.filter((item) => item.service_type.name === "Household"),
      shoe: returnData.filter((item) => item.service_type.name === "Shoe"),
      laundry: returnData.filter((item) => item.service_type.name === "Laundry"),
    }

    return res.status(200).json(returnThis);

  }
  catch (err) {
    console.error("Error when finding all fabric type ");
    console.error(err);
    return res.status(400).json({ error: "Internal Error" });
  }
});
// EDIT FABRIC DETAILS
// POST @-> /api/fabric/update
// To edit fabric details
router.post('/update', (req, res) => {
  const { id, name, newprice, newstatus, photoUrl, filetype, serviceTypeId, strategy } = req.body;
  if (!id || !name || !serviceTypeId || !strategy) { return res.status(400).json({ error: 'Missing details' }) }
  Fabric.findByPk(id)
    .then((foundService) => {
      if (!foundService)
        return res.status(400).json({ error: 'Service not found' });
      if (photoUrl) {
        const regex = /^data:image\/\w+;base64,/;
        const body = Buffer.from(photoUrl.replace(regex, ''), 'base64');
        const Key = `${serviceTypeId}/itemtype/${strategy}/${name}`;
        //uploading img to s3
        uploadtos3(Key, body, 'base64', filetype, (status) => {
          if (status === 'failed') {
            console.error('S3 image upload failed.');
            return res.status(400).json({ error: 'Image Upload Failed' });
          }
          foundService.name = name;
          foundService.price = newprice ? newprice : foundService.price;
          foundService.status = newstatus;
          foundService.photo_url = Key;
          foundService.strategy = strategy;
          foundService
            .save()
            .then((savedService) => {
              return res.status(200).json(savedService);
            })
            .catch((err) => {
              console.error('Error when updating fabric: \n', err);
              return res.status(400).json({ error: 'Internal Error' });
            });
        })
      }
      else {
        foundService.name = name;
        foundService.strategy = strategy;
        foundService.price = newprice ? newprice : foundService.price;
        foundService.status = newstatus;
        foundService
          .save()
          .then((savedService) => {
            return res.status(200).json(savedService);
          })
          .catch((err) => {
            console.error('Error when finding service in update details');
            console.error(err);
            return res.status(400).json({ error: 'Internal Error' });
          });
      }
    })
})

router.post('/updatePricingStrategy', async (req, res) => {
  const { strategy, newStrategy } = req.body;
  console.log('upodate pricing', req.body)
  try {
    const checkStrategy = await Fabric.findAll({ where: { strategy } })
    console.log('show all', checkStrategy.length)

    for (let a = 0; a < checkStrategy.length; a++) {
      let data = checkStrategy[a]
      data.strategy = newStrategy;
      await data.save()
    }
    return res.status(200).json({ message: 'Updated Successfully' });
  }
  catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
})

router.post('/duplicateList', async (req, res) => {
  const { strategy, newName } = req.body;
  if (!strategy) { return res.status(400).json({ error: 'Missing details' }) }
  try {
    const checkPricing = await Fabric.findAll({ where: { strategy } })
    for (let p = 0; p < checkPricing.length; p++) {

      let data = checkPricing[p]
      const createItem = new Fabric({
        name: data.name,
        price: data.price,
        photo_url: data.photo_url,
        serviceTypeId: data.serviceTypeId,
        status: true,
        strategy: newName,
      })
      await createItem.save()

    }
    return res.status(200).json({ message: "Created Successfully" });
  }
  catch (err) {
    console.error('Error when updating fabric: \n', err);
    return res.status(400).json({ error: 'Internal Error' });
  }
})

module.exports = router;
