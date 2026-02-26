import express from 'express';
import { fetchBrands, fetchModelsByBrand } from '../controllers/vehicleMaster.controller.js';

const router = express.Router();

// Get all active brands
router.get('/brands', fetchBrands);

// Get models for a specific brand
router.get('/brands/:brandId/models', fetchModelsByBrand);

export default router;
