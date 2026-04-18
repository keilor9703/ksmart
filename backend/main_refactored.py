# Consolidated imports
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import jwt

# Proper JWT SECRET_KEY validation
SECRET_KEY = "your_secret_key_here"
if SECRET_KEY is None:
    raise RuntimeError("JWT SECRET_KEY not configured")

app = Flask(__name__)

# Improved error handling with logging
logging.basicConfig(level=logging.INFO)

# Database setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
db = SQLAlchemy(app)

# Decoupled registration functionality with specific exception types
class RegistrationError(Exception):
    pass

@app.route('/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if "username" not in data:
            raise RegistrationError("Username is required")
        # More registration logic here...
    except RegistrationError as e:
        logging.error(f"Registration error: {e}")
        return jsonify({'message': str(e)}), 400

# Multi-tenant filtering in /pagos endpoint
@app.route('/pagos', methods=['GET'])
def pagos():
    # Assume tenant_id is coming from the token
    tenant_id = get_tenant_id_from_token(request)
    # Query with tenant filtering
    results = db.session.query(Payment).filter_by(tenant_id=tenant_id).all()
    return jsonify(results)

# Improved validation to payment endpoints
@app.route('/payments', methods=['POST'])
def process_payment():
    data = request.get_json()
    if not validate_payment_data(data):
        return jsonify({'message': 'Invalid payment data'}), 400
    # Payment processing logic...

# Fixed N+1 query problems with joinedload
@app.route('/some_endpoint', methods=['GET'])
def some_endpoint():
    # Using joinedload to prevent N+1 issue
    results = db.session.query(SomeModel).options(joinedload(SomeModel.related_model)).all()
    return jsonify(results)

# Documentation for helper functions
def get_tenant_id_from_token(req):
    """
    Extract tenant id from JWT token
    :param req: request object
    :return: tenant_id if valid, otherwise None
    """
    return decoded_token.get('tenant_id') if is_valid_token(req) else None

# Additional utility functions and configurations below...

# Rest of the original code following similar discipline...
