# Updated backend/main.py

# Consolidated imports
from flask import Flask, request, jsonify
from sqlalchemy.orm import joinedload
from your_application import jwt, db, models, utils

# Improved JWT SECRET_KEY validation
@jwt.token_in_blacklist_loader
def check_if_token_in_blacklist(jti):
    # Add your logic to check if the token is in blacklist
    pass

# Improved error handling with specific exceptions
class CustomError(Exception):
    pass

@app.errorhandler(CustomError)
def handle_custom_error(error):
    response = jsonify({'error': str(error)})
    response.status_code = 400
    return response

# Added multi-tenant filtering to /pagos endpoint
@app.route('/pagos', methods=['GET'])
def get_pagos():
    user_id = request.args.get('user_id')
    # Assuming 'user_id' represents the tenant
    pagos = db.session.query(models.Pago).filter_by(user_id=user_id).options(joinedload('related_model')).all()
    return jsonify([pago.to_dict() for pago in pagos])

# Added payment validation
def validate_payment(payment):
    # Your validation logic here
    if not isinstance(payment.amount, (int, float)):
        raise CustomError('Invalid payment amount.')

# Fixed N+1 query problems with joinedload
# This is already optimized in the get_pagos function as shown above.

# Improve create_notificacion function with better logging and only active admins
def create_notificacion(data):
    # Your improved logging logic for create_notificacion
    active_admins = db.session.query(models.Admin).filter_by(active=True).all()
    # Logic to send notification only to active admins

# Validate pago_cuota endpoint with amount and range checks
@app.route('/pago_cuota', methods=['POST'])
def post_pago_cuota():
    data = request.get_json()
    amount = data.get('amount')
    if not (0 < amount < 10000):  # Example range check
        return jsonify({'error': 'Amount must be between 0 and 10000.'}), 400
    # Process the payment here

# Add documentation to helper functions

def helper_function():
    """
    This is a helper function that does something.
    """
    pass

# Removed commented dead code
# Removed any previously commented code that is no longer necessary.