"""
URL configuration for certificacionblockchain project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

from documentos import views

""" Este path sirve para que los templates puedan acceder a la carpeta documentos """
urlpatterns = [
    path('', views.index, name='index'),   # Muestra el index.html
    path('subir/', views.upload_document, name='upload_document'),  # Procesa la certificación
    path('verificar/', views.verify_document, name='verify_document'),  # Procesa la verificación
]